// lib/vnpay.ts
import crypto from 'crypto'
import qs from 'qs'

const VNPAY_URL     = process.env.VNPAY_URL!
const TMN_CODE      = process.env.VNPAY_TMN_CODE!
const HASH_SECRET   = process.env.VNPAY_HASH_SECRET!
const RETURN_URL    = `${process.env.NEXT_PUBLIC_APP_URL}/payment/return`

export function createVNPayUrl(params: {
  amount: number        // VND
  orderInfo: string
  txnRef: string        // transaction UUID
  ipAddr?: string
}): string {
  const date = new Date()
  const createDate = date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)

  const vnpParams: Record<string, string> = {
    vnp_Version:    '2.1.0',
    vnp_Command:    'pay',
    vnp_TmnCode:    TMN_CODE,
    vnp_Locale:     'vn',
    vnp_CurrCode:   'VND',
    vnp_TxnRef:     params.txnRef,
    vnp_OrderInfo:  params.orderInfo,
    vnp_OrderType:  'other',
    vnp_Amount:     String(params.amount * 100), // VNPay nhân 100
    vnp_ReturnUrl:  RETURN_URL,
    vnp_IpAddr:     params.ipAddr || '127.0.0.1',
    vnp_CreateDate: createDate,
  }

  // Sort params A-Z (bắt buộc theo VNPay spec)
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce<Record<string, string>>((acc, k) => { acc[k] = vnpParams[k]; return acc }, {})

  const signData = qs.stringify(sortedParams, { encode: false })
  const hmac = crypto.createHmac('sha512', HASH_SECRET)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  sortedParams['vnp_SecureHash'] = signed
  return `${VNPAY_URL}?${qs.stringify(sortedParams, { encode: false })}`
}

export function verifyVNPayReturn(query: Record<string, string>): boolean {
  const secureHash = query['vnp_SecureHash']
  const params = { ...query }
  delete params['vnp_SecureHash']
  delete params['vnp_SecureHashType']

  const sortedParams = Object.keys(params)
    .sort()
    .reduce<Record<string, string>>((acc, k) => { acc[k] = params[k]; return acc }, {})

  const signData = qs.stringify(sortedParams, { encode: false })
  const hmac = crypto.createHmac('sha512', HASH_SECRET)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  return signed === secureHash
}

export function isVNPaySuccess(query: Record<string, string>): boolean {
  return query['vnp_ResponseCode'] === '00' && query['vnp_TransactionStatus'] === '00'
}
