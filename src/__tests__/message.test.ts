/* eslint-disable @typescript-eslint/no-explicit-any */
import * as github from '@actions/github'
import {afterAll, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {postMessage} from '../message'
import {SlackClient} from '../slack/client'

describe('postMessage', () => {
  let slack: SlackClient
  let ts: string | undefined

  const OLD_CONTEXT = github.context
  const OLD_ENV = process.env

  beforeEach(() => {
    slack = {
      postMessage: jest.fn(async () => 'TS'),
      updateMessage: jest.fn(async () => undefined)
    } as any

    jest.resetModules()
    process.env = {...OLD_ENV}

    github.context.workflow = 'Deploy App'
    github.context.eventName = OLD_CONTEXT.eventName
    github.context.payload = OLD_CONTEXT.payload

    jest.useFakeTimers().setSystemTime(new Date('2022-09-10T00:00:00.000Z'))
  })

  afterAll(() => {
    process.env = OLD_ENV

    github.context.eventName = OLD_CONTEXT.eventName
    github.context.payload = OLD_CONTEXT.payload
  })

  describe('first summary', () => {
    beforeEach(async () => {
      github.context.eventName = 'pull_request'
      github.context.payload = {
        pull_request: {
          title: 'PR-TITLE',
          number: 1,
          html_url: 'github.com/PR-1',
          head: {
            ref: 'my-pr'
          }
        },
        sender: {
          type: 'user',
          login: 'namoscato',
          avatar_url: 'github.com/namoscato'
        }
      }

      ts = await postMessage({slack})
    })

    it('should post slack message', () => {
      expect(slack.postMessage).toHaveBeenCalledTimes(1)
      expect(slack.postMessage).toHaveBeenCalledWith({
        icon_url: 'github.com/namoscato',
        username: 'namoscato (via GitHub)',
        unfurl_links: false,
        text: 'Deploying action-testing: PR-TITLE (#1)',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':black_square_button: Deploying *action-testing*: <github.com/PR-1|PR-TITLE (#1)>'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '<github.com/PR-1/checks|Deploy App>  ∙  my-pr'
              }
            ]
          }
        ]
      })
    })

    it('should return timestamp ID', () => {
      expect(ts).toStrictEqual('TS')
    })
  })

  describe('intermediate stage', () => {
    beforeEach(async () => {
      process.env.INPUT_THREAD_TS = '1662768005' // 2022-09-10T00:00:05.000Z

      github.context.eventName = 'push'
      github.context.job = 'JOB'
      github.context.sha = '05b16c3beb3a07dceaf6cf964d0be9eccbc026e8'
      github.context.payload = {
        head_commit: {
          message: 'COMMIT-MESSAGE',
          url: 'github.com/commit'
        },
        sender: {
          type: 'user',
          login: 'namoscato',
          avatar_url: 'github.com/namoscato'
        }
      }
    })

    describe('success', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'success'

        ts = await postMessage({slack})
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledTimes(1)
        expect(slack.postMessage).toHaveBeenCalledWith({
          icon_url: 'github.com/namoscato',
          username: 'namoscato (via GitHub)',
          unfurl_links: false,
          text: 'Finished JOB',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':white_check_mark: Finished *JOB*'
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '<https://github.com/namoscato/action-testing/commit/05b16c3beb3a07dceaf6cf964d0be9eccbc026e8/checks|Deploy App>  ∙  05b16c3  ∙  5 seconds'
                }
              ]
            }
          ],
          reply_broadcast: false,
          thread_ts: '1662768005' // 2022-09-10T00:00:05.000Z
        })
      })

      it('should not update summary message', () => {
        expect(slack.updateMessage).not.toHaveBeenCalled()
      })

      it('should not return timestamp ID', () => {
        expect(ts).toBeUndefined()
      })
    })

    describe('cancelled', () => {
      beforeEach(async () => {
        process.env.INPUT_STATUS = 'cancelled'

        ts = await postMessage({slack})
      })

      it('should post slack message', () => {
        expect(slack.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Cancelled JOB',
            blocks: expect.arrayContaining([
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':no_entry_sign: Cancelled *JOB*'
                }
              }
            ]),
            reply_broadcast: true
          })
        )
      })

      it('should update summary message', () => {
        expect(slack.updateMessage).toHaveBeenCalledTimes(1)
        expect(slack.updateMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Cancelled deploying action-testing: COMMIT-MESSAGE',
            blocks: expect.arrayContaining([
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':no_entry_sign: Cancelled deploying *action-testing*: <github.com/commit|COMMIT-MESSAGE>'
                }
              }
            ]),
            ts: '1662768005' // 2022-09-10T00:00:05.000Z
          })
        )
      })
    })
  })
})
