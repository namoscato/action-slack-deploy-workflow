import {isDebug, warning} from '@actions/core'
import {LogLevel, WebClient, WebClientEvent} from '@slack/web-api'
import {isMissingScopeError} from './errors'
import type {
  Member,
  PostMessageArguments,
  PostThreadedMessageArguments,
  UpdateMessageArguments
} from './types'

interface Dependencies {
  token: string
  channelPrimary: string
  channelErrors: string | undefined
}

export class SlackClient {
  private readonly web: WebClient
  private readonly channelPrimary: string
  private readonly channelErrors: string | null

  constructor({token, channelPrimary, channelErrors}: Dependencies) {
    this.channelPrimary = channelPrimary
    this.channelErrors = channelErrors ?? null

    this.web = new WebClient(token, {
      logLevel: isDebug() ? LogLevel.DEBUG : LogLevel.INFO
    })
    this.logRateLimits()
  }

  /**
   * Return the set of non-bot users.
   *
   * @returns `null` if the bot token is missing the required OAuth scope
   */
  async getRealUsers(): Promise<Member[] | null> {
    try {
      const {members} = await this.web.users.list({})

      if (!members) {
        throw new Error('Error fetching users')
      }

      return members.filter(({id, is_bot}) => {
        return (
          'USLACKBOT' !== id && // USLACKBOT is a special user ID for @SlackBot
          !is_bot
        )
      })
    } catch (error) {
      if (isMissingScopeError(error)) {
        return null
      }

      throw error
    }
  }

  /**
   * @returns message timestamp ID
   */
  async postMessage(options: PostMessageArguments): Promise<string> {
    const {ts} = await this.web.chat.postMessage({
      ...options,
      channel: this.channelPrimary
    })

    if (!ts) {
      throw new Error('Response timestamp ID undefined')
    }

    return ts
  }

  async postThreadedMessage({
    successful,
    thread_ts,
    ...options
  }: PostThreadedMessageArguments): Promise<void> {
    if (successful) {
      // always post successful messages in primary channel thread
      await this.web.chat.postMessage({
        ...options,
        channel: this.channelPrimary,
        thread_ts
      })
    } else if (this.channelErrors) {
      // post to error channel
      await this.web.chat.postMessage({
        ...options,
        channel: this.channelErrors
      })

      // and primary channel thread
      await this.web.chat.postMessage({
        ...options,
        channel: this.channelPrimary,
        thread_ts
      })
    } else {
      // broadcast error message to primary channel
      await this.web.chat.postMessage({
        ...options,
        channel: this.channelPrimary,
        thread_ts,
        reply_broadcast: true
      })
    }
  }

  async updateMessage(options: UpdateMessageArguments): Promise<void> {
    await this.web.chat.update({...options, channel: this.channelPrimary})
  }

  /**
   * @see https://slack.dev/node-slack-sdk/web-api#rate-limits
   */
  private logRateLimits(): void {
    this.web.on(WebClientEvent.RATE_LIMITED, numSeconds => {
      warning(
        `Slack API call failed due to rate limiting. Retrying in ${numSeconds} seconds.`
      )
    })
  }
}
