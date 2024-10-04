import {getInput, info} from '@actions/core'
import {getStageMessage} from './github/getStageMessage'
import {getSummaryMessage} from './github/getSummaryMessage'
import {OctokitClient, isSuccessful} from './github/types'
import {SlackClient} from './slack/SlackClient'
import {MessageAuthor} from './slack/types'

interface Dependencies {
  octokit: OctokitClient
  slack: SlackClient
  author: MessageAuthor | null
}

/**
 * Post an initial summary message or progress reply when `thread_ts` input is set.
 *
 * Conditionally updates initial message when `conclusion` is set or stage is unsuccessful.
 *
 * @returns message timestamp ID
 */
export async function postMessage({
  octokit,
  slack,
  author
}: Dependencies): Promise<string | null> {
  const threadTs = getInput('thread_ts')

  if (!threadTs) {
    info('Posting summary message')
    const message = await getSummaryMessage({octokit, author})

    return slack.postMessage(message)
  }

  const status = getInput('status', {required: true})
  const now = new Date()
  const stageMessage = await getStageMessage({
    octokit,
    status,
    now,
    author
  })

  info(`Posting stage message in thread: ${threadTs}`)
  await slack.postThreadedMessage({
    ...stageMessage,
    thread_ts: threadTs
  })

  const conclusion = 'true' === getInput('conclusion')

  if (conclusion || !isSuccessful(status)) {
    info(`Updating summary message: ${status}`)
    const summaryMessage = await getSummaryMessage({
      octokit,
      options: {status, threadTs, now},
      author
    })

    await slack.updateMessage({
      ...summaryMessage,
      ts: threadTs
    })
  }

  return null
}
