// lib/momo.ts
import crypto from 'crypto'

const ENDPOINT     = process.env.MOMO_ENDPOINT!
const PARTNER_CODE = process.env.MOMO_PARTNER_CODE!
const ACCESS_KEY   = process.env.MOMO_ACCESS_KEY!
const SECRET_KEY   = process.env.MOMO_SECRET_KEY!
const REDIRECT_URL = `${process.env.NEXT_PUBLIC_APP_URL}/payment/return`
const IPN_URL      = `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/momo-ipn`

export async function createMoMoPayment(params: {
  amount: number
  orderInfo: string
  orderId: string       // transaction UUID
}): Promise<{ payUrl: string; message: string; resultCode: number }> {
  const requestId = `${params.orderId}-${Date.now()}`
  const extraData = ''
  const requestType = 'payWithMethod'

  // Tạo chữ ký theo MoMo spec
  const rawSignature = [
    `accessKey=${ACCESS_KEY}`,
    `amount=${params.amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${IPN_URL}`,
    `orderId=${params.orderId}`,
    `orderInfo=${params.orderInfo}`,
    `partnerCode=${PARTNER_CODE}`,
    `redirectUrl=${REDIRECT_URL}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join('&')

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(rawSignature)
    .digest('hex')

  const body = {
    partnerCode: PARTNER_CODE,
    partnerName: 'Ngoc AI Appraisal',
    storeId: PARTNER_CODE,
    requestId,
    amount: params.amount,
    orderId: params.orderId,
    orderInfo: params.orderInfo,
    redirectUrl: REDIRECT_URL,
    ipnUrl: IPN_URL,
    lang: 'vi',
    requestType,
    autoCapture: true,
    extraData,
    signature,
  }

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return resp.json()
}

export function verifyMoMoIPN(body: Record<string, unknown>): boolean {
  const {
    accessKey, amount, extraData, message, orderId, orderInfo,
    orderType, partnerCode, payType, requestId, responseTime,
    resultCode, transId, signature: receivedSig,
  } = body as Record<string, string | number>

  const rawSignature = [
    `accessKey=${ACCESS_KEY}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join('&')

  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(rawSignature)
    .digest('hex')

  return expectedSig === receivedSig
}
