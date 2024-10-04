import type {KnownBlock, UsersListResponse} from '@slack/web-api'

export type Member = NonNullable<UsersListResponse['members']>[0]

export interface MemberWithProfile extends Member {
  profile: Member['profile'] & {
    display_name: string
    image_48: string
  }
}

/**
 * @see https://api.slack.com/methods/chat.postMessage#authorship
 */
export interface MessageAuthor {
  /** Slack workspace user identifier */
  slack_user_id?: string
  /** bot's user name */
  username: string
  /** URL to an image to use as the icon for this message */
  icon_url: string
}

export interface Link {
  text: string
  url: string
}

export interface Image {
  alt_text: string
  image_url: string
}

/** Stricter and compatible with `ChatPostMessageArguments` / `ChatUpdateArguments` */
export interface PostMessageArguments {
  /** URL to an image to use as the icon for this message */
  icon_url: string | undefined
  /** Set your bot's username */
  username: string | undefined
  /** Pass `true` to enable unfurling of primarily text-based content. */
  unfurl_links: boolean
  /** Fallback notification text. */
  text: string
  /** An array of structured Blocks. */
  blocks: KnownBlock[]
}

export interface PostThreadedMessageArguments extends PostMessageArguments {
  /** Provide another message's `ts` value to post this message in a thread. */
  thread_ts: string
  /** Denotes the stage message status. */
  successful: boolean
}

export interface UpdateMessageArguments extends PostMessageArguments {
  /** Timestamp of the message. */
  ts: string
}
