import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {CodedError, ErrorCode} from '@slack/web-api'
import {SlackClient} from '../SlackClient'
import {Member} from '../types'

const listUsers = jest.fn()
const postMessage = jest.fn()

jest.mock('@slack/web-api', () => ({
  ErrorCode: {
    PlatformError: 'slack_webapi_platform_error'
  },
  LogLevel: {},
  WebClient: class MockWebClient {
    on(): void {
      // noop
    }
    chat = {
      postMessage
    }
    users = {
      list: listUsers
    }
  },
  WebClientEvent: {}
}))

describe('SlackClient', () => {
  let client: SlackClient

  describe('getRealUsers', () => {
    let users: Member[] | null

    beforeEach(() => {
      client = new SlackClient({
        token: 'TOKEN',
        channelPrimary: 'CHANNEL',
        channelErrors: undefined
      })
    })

    describe('unexpected response', () => {
      let error: unknown

      beforeEach(async () => {
        listUsers.mockReturnValueOnce(Promise.resolve({}))

        try {
          await client.getRealUsers()
        } catch (err) {
          error = err
        }
      })

      it('should throw error', () => {
        expect(error).toBeInstanceOf(Error)
      })
    })

    describe('missing scope error', () => {
      beforeEach(async () => {
        listUsers.mockImplementation(() => {
          throw new SlackCodedError(ErrorCode.PlatformError, 'missing_scope')
        })

        users = await client.getRealUsers()
      })

      it('should return null', () => {
        expect(users).toBeNull()
      })
    })

    describe('success', () => {
      beforeEach(async () => {
        listUsers.mockReturnValueOnce(
          Promise.resolve({
            members: [
              {id: 'U1'},
              {id: 'U2', is_bot: false},
              {id: 'U3', is_bot: true},
              {id: 'USLACKBOT', is_bot: false}
            ]
          })
        )

        users = await client.getRealUsers()
      })

      it('should filter real users', () => {
        expect(users).toStrictEqual([{id: 'U1'}, {id: 'U2', is_bot: false}])
      })
    })
  })

  describe('postThreadedMessage', () => {
    describe('only primary channel configured', () => {
      beforeEach(() => {
        client = new SlackClient({
          token: 'TOKEN',
          channelPrimary: 'CHANNEL',
          channelErrors: undefined
        })
      })

      describe('successful', () => {
        beforeEach(async () => {
          await client.postThreadedMessage({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            successful: true,
            thread_ts: 'THREAD_TS'
          })
        })

        it('should post message in primary channel thread', () => {
          expect(postMessage).toHaveBeenCalledTimes(1)
          expect(postMessage).toHaveBeenCalledWith({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            channel: 'CHANNEL',
            thread_ts: 'THREAD_TS'
          })
        })
      })

      describe('error', () => {
        beforeEach(async () => {
          await client.postThreadedMessage({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            successful: false,
            thread_ts: 'THREAD_TS'
          })
        })

        it('should broadcast message to primary channel', () => {
          expect(postMessage).toHaveBeenCalledWith({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            channel: 'CHANNEL',
            thread_ts: 'THREAD_TS',
            reply_broadcast: true
          })
        })
      })
    })

    describe('error channel configured', () => {
      beforeEach(() => {
        client = new SlackClient({
          token: 'TOKEN',
          channelPrimary: 'CHANNEL',
          channelErrors: 'CHANNEL_ERRORS'
        })
      })

      describe('successful', () => {
        beforeEach(async () => {
          await client.postThreadedMessage({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            successful: true,
            thread_ts: 'THREAD_TS'
          })
        })

        it('should post message in primary channel thread', () => {
          expect(postMessage).toHaveBeenCalledWith({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            channel: 'CHANNEL',
            thread_ts: 'THREAD_TS'
          })
        })
      })

      describe('error', () => {
        beforeEach(async () => {
          await client.postThreadedMessage({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            successful: false,
            thread_ts: 'THREAD_TS'
          })
        })

        it('should post message to error channel', () => {
          expect(postMessage).toHaveBeenCalledTimes(2)
          expect(postMessage).toHaveBeenCalledWith({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            channel: 'CHANNEL_ERRORS'
          })
        })

        it('should post message to primary channel thread', () => {
          expect(postMessage).toHaveBeenCalledWith({
            icon_url: undefined,
            username: undefined,
            unfurl_links: false,
            text: 'TEXT',
            blocks: [],
            channel: 'CHANNEL',
            thread_ts: 'THREAD_TS'
          })
        })
      })
    })
  })
})

class SlackCodedError extends Error implements CodedError {
  data: unknown

  constructor(
    readonly code: ErrorCode,
    error: string
  ) {
    super(error)

    this.data = {ok: false, error}
  }
}
