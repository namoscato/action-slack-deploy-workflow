import {ContextBlock} from '@slack/web-api'
import {emoji} from '../slack/mrkdwn'
import {MessageAuthor, PostMessageArguments} from '../slack/types'
import {JobStatus, Text} from './types'

interface Dependencies {
  text: Text
  contextBlock: ContextBlock
  author: MessageAuthor | null
}

export function createMessage({
  text,
  contextBlock,
  author
}: Dependencies): PostMessageArguments {
  return {
    icon_url: author?.icon_url,
    username: author?.username ? `${author.username} (via GitHub)` : undefined,
    unfurl_links: false,
    text: text.plain,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text.mrkdwn
        }
      },
      contextBlock
    ]
  }
}

export function emojiFromStatus(status: string): string {
  switch (status) {
    case JobStatus.Success:
      return emoji('white_check_mark')
    case JobStatus.Failure:
      return emoji('x')
    case JobStatus.Cancelled:
      return emoji('no_entry_sign')
    default:
      throw new Error(`Unexpected status ${status}`)
  }
}
