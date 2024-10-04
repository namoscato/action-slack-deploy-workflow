import * as github from '@actions/github'
import {intervalToDuration} from 'date-fns'
import {bold, emoji, link} from '../slack/mrkdwn'
import {Link, MessageAuthor, PostMessageArguments} from '../slack/types'
import {dateFromTs} from '../slack/utils'
import {getContextBlock} from './getContextBlock'
import {createMessage, emojiFromStatus} from './message'
import {JobStatus, OctokitClient, Text} from './types'
import {
  SupportedContext,
  assertUnsupportedEvent,
  isPullRequestEvent,
  isPushEvent,
  isReleaseEvent,
  isScheduleEvent,
  isWorkflowDispatchEvent
} from './webhook'

interface Options {
  status: string
  threadTs: string
  now: Date
}

interface Dependencies {
  octokit: OctokitClient
  options?: Options
  author: MessageAuthor | null
}

/**
 * Return the initial summary message.
 */
export async function getSummaryMessage({
  octokit,
  options,
  author
}: Dependencies): Promise<PostMessageArguments> {
  const text = await getText(octokit, options?.status ?? null, author)

  const duration = options
    ? intervalToDuration({
        start: dateFromTs(options.threadTs),
        end: options.now
      })
    : undefined

  const contextBlock = getContextBlock(duration)

  return createMessage({text, contextBlock, author})
}

async function getText(
  octokit: OctokitClient,
  status: string | null,
  author: MessageAuthor | null
): Promise<Text> {
  const summarySentence = getSummarySentence(status, author)
  const eventLink = await getEventLink(octokit)

  const mrkdwn = [
    status ? emojiFromStatus(status) : emoji('black_square_button'),
    `${summarySentence.mrkdwn}:`,
    link(eventLink)
  ].join(' ')

  return {
    plain: `${summarySentence.plain}: ${eventLink.text}`,
    mrkdwn
  }
}

function getSummarySentence(
  status: string | null,
  author: MessageAuthor | null
): Text {
  const subject: Text = {plain: '', mrkdwn: ''}
  let verb = status ? verbFromStatus(status) : 'Deploying'

  if (author?.slack_user_id) {
    subject.plain = author.username
    subject.mrkdwn = `<@${author.slack_user_id}>`

    verb = status ? ` ${verb.toLowerCase()}` : ` is ${verb.toLowerCase()}`
  }

  const {repo} = github.context.repo

  return {
    plain: `${subject.plain}${verb} ${repo}`,
    mrkdwn: `${subject.mrkdwn}${verb} ${bold(repo)}`
  }
}

function verbFromStatus(status: string): string {
  switch (status) {
    case JobStatus.Success:
      return 'Deployed'
    case JobStatus.Failure:
      return 'Failed deploying'
    case JobStatus.Cancelled:
      return 'Cancelled deploying'
    default:
      throw new Error(`Unexpected status ${status}`)
  }
}

async function getEventLink(octokit: OctokitClient): Promise<Link> {
  const context = github.context as SupportedContext

  if (isPullRequestEvent(context)) {
    const pullRequest = context.payload.pull_request

    return {
      text: getEventLinkText(`${pullRequest.title} (#${pullRequest.number})`),
      url: pullRequest.html_url
    }
  }

  if (isPushEvent(context)) {
    const commit = context.payload.head_commit

    if (!commit) {
      throw new Error('Unexpected push event payload (undefined head_commit)')
    }

    return {
      text: getEventLinkText(commit.message),
      url: commit.url
    }
  }

  if (isReleaseEvent(context)) {
    return {
      text: context.payload.release.name,
      url: context.payload.release.html_url
    }
  }

  if (isScheduleEvent(context) || isWorkflowDispatchEvent(context)) {
    const commit = (
      await octokit.rest.repos.getCommit({
        ...context.repo,
        ref: context.sha
      })
    ).data.commit

    return {
      text: getEventLinkText(commit.message),
      url: commit.url
    }
  }

  assertUnsupportedEvent(context)
}

/**
 * Return the first `message` line, i.e. omitting the commit description.
 */
function getEventLinkText(message: string): string {
  return message.split('\n', 1)[0]
}
