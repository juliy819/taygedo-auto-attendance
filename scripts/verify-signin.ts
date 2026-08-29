import { readFile } from 'node:fs/promises'
import { TaygedoApi } from '../src/taygedo/api.js'
import { parseAccountsSecret } from '../src/config/accounts.js'

async function main(): Promise<void> {
  const accountsPath = process.env.ACCOUNTS_FILE
  const accountsSecret = process.env.TAYGEDO_ACCOUNTS

  let raw: string
  if (accountsPath) {
    raw = await readFile(accountsPath, 'utf8')
  } else if (accountsSecret) {
    raw = accountsSecret
  } else {
    throw new Error('用法：ACCOUNTS_FILE=path tsx scripts/verify-signin.ts，或设置 TAYGEDO_ACCOUNTS 环境变量')
  }

  const accounts = parseAccountsSecret(raw)
  const account = accounts[0]
  if (!account) {
    throw new Error('账号列表为空')
  }

  console.log(`账号：${account.name}（uid=${account.uid}，deviceId=${account.deviceId.slice(0, 8)}…）`)

  const api = new TaygedoApi()

  let accessToken = account.accessToken
  if (!accessToken) {
    console.log('refreshToken 刷新令牌中…')
    const refreshed = await api.refreshToken(account.refreshToken, account.deviceId)
    accessToken = refreshed.accessToken
    console.log(`刷新成功，新 accessToken=${accessToken.slice(0, 12)}…`)
  } else {
    console.log(`使用已有 accessToken=${accessToken.slice(0, 12)}…`)
  }

  console.log('调用 appSignin（修复后走 buildNativeRequest + ds 签名）…')
  try {
    const result = await api.appSignin(accessToken, account.uid, account.deviceId)
    console.log(`✓ 签到成功：经验 +${result.exp}，金币 +${result.goldCoin}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('已签到') || msg.includes('already') || msg.includes('repeat')) {
      console.log('✓ 今日已签到（未重复签到）')
    } else {
      console.error(`✗ 签到失败：${msg}`)
      process.exitCode = 1
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
