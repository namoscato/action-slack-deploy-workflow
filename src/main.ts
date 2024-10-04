import {error, getInput, isDebug, setFailed, setOutput} from '@actions/core'
import {getOctokit} from '@actions/github'
import {getMessageAuthor} from './getMessageAuthor'
import {OctokitClient} from './github/types'
import {EnvironmentVariable, getEnv, getRequiredEnv} from './input'
import {postMessage} from './postMessage'
import {SlackClient} from './slack/SlackClient'

run()

async function run(): Promise<void> {
  try {
    const octokit = createOctokitClient()
    const slack = createSlackClient()

    const author = await getMessageAuthor(octokit, slack)
    const ts = await postMessage({octokit, slack, author})

    if (ts) {
      setOutput('ts', ts)
    }
  } catch (err) {
    setFailed(err instanceof Error ? err : String(err))

    if (isDebug() && err instanceof Error && err.stack) {
      error(err.stack)
    }
  }
}

function createSlackClient(): SlackClient {
  const token = getRequiredEnv(EnvironmentVariable.SlackBotToken)
  const channelPrimary = getRequiredEnv(EnvironmentVariable.SlackChannelPrimary)
  const channelUnsuccessful = getEnv(EnvironmentVariable.SlackChannelErrors)

  return new SlackClient({
    token,
    channelPrimary,
    channelErrors: channelUnsuccessful
  })
}

function createOctokitClient(): OctokitClient {
  const token = getInput('github_token', {required: true})

  return getOctokit(token)
}
