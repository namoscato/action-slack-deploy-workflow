export enum EnvironmentVariable {
  SlackBotToken = 'SLACK_DEPLOY_BOT_TOKEN',
  SlackChannelPrimary = 'SLACK_DEPLOY_CHANNEL',
  SlackChannelErrors = 'SLACK_DEPLOY_CHANNEL_ERRORS'
}

/**
 * Get the value of an environment variable.
 *
 * The value is trimmed of whitespace.
 */
export function getEnv(name: EnvironmentVariable): string | undefined {
  return String(process.env[name] ?? '').trim() || undefined
}

/**
 * Get the value of a required environment variable.
 */
export function getRequiredEnv(name: EnvironmentVariable): string {
  const env = getEnv(name)

  if (!env) {
    throw new Error(`${name} environment variable required`)
  }

  return env
}
