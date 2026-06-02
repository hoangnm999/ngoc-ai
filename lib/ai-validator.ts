// lib/ai-validator.ts — v5.1
// Fix: color validator chỉ check màu CHÍNH, không bắt màu phụ trong mô tả dài

import type { AIResult } from './ai-panel'

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist đá thật
// ─────────────────────────────────────────────────────────────────────────────

const STONE_WHITELIST: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'emerald',      aliases: ['ngọc lục bảo', 'ngoc luc bao', 'luc bao', 'beryl xanh', 'emerald'] },
  { canonical: 'ruby',         aliases: ['hồng ngọc', 'hong ngoc', 'ruby', 'corundum đỏ'] },
  { canonical: 'sapphire',     aliases: ['lam ngọc', 'lam ngoc', 'saphia', 'sapphire', 'corundum xanh'] },
  { canonical: 'jadeite',      aliases: ['phỉ thúy', 'phi thuy', 'jadeite', 'jade loại a', 'ngọc phỉ thúy'] },
  { canonical: 'nephrite',     aliases: ['ngọc bích', 'ngoc bich', 'nephrite', 'jade loại b', 'canadian jade'] },
  { canonical: 'diamond',      aliases: ['kim cương', 'kim cuong', 'diamond'] },
  { canonical: 'quartz',       aliases: ['thạch anh', 'thach anh', 'quartz', 'crystal', 'pha lê'] },
  { canonical: 'amethyst',     aliases: ['thạch anh tím', 'thach anh tim', 'amethyst'] },
  { canonical: 'citrine',      aliases: ['thạch anh vàng', 'thach anh vang', 'citrine'] },
  { canonical: 'topaz',        aliases: ['topaz', 'hoàng ngọc', 'hoang ngoc', 'blue topaz'] },
  { canonical: 'tourmaline',   aliases: ['tourmaline', 'điện khí thạch', 'rubellite'] },
  { canonical: 'garnet',       aliases: ['garnet', 'thạch lựu', 'pyrope', 'almandine'] },
  { canonical: 'opal',         aliases: ['opal'] },
  { canonical: 'aquamarine',   aliases: ['aquamarine', 'ngọc lam', 'beryl xanh lam'] },
  { canonical: 'peridot',      aliases: ['peridot', 'olivine'] },
  { canonical: 'lapis lazuli', aliases: ['lapis lazuli', 'đá lapis', 'thanh kim thạch'] },
  { canonical: 'tanzanite',    aliases: ['tanzanite'] },
  { canonical: 'spinel',       aliases: ['spinel', 'red spinel', 'blue spinel'] },
  { canonical: 'fluorite',     aliases: ['fluorite'] },
  { canonical: 'iolite',       aliases: ['iolite', 'cordierite'] },
  { canonical: 'kyanite',      aliases: ['kyanite'] },
  { canonical: 'moonstone',    aliases: ['đá mặt trăng', 'moonstone', 'orthoclase'] },
  { canonical: 'malachite',    aliases: ['malachite', 'khổng tước thạch'] },
  { canonical: 'labradorite',  aliases: ['labradorite'] },
  { canonical: 'serpentine',   aliases: ['serpentine', 'jade giả serpentine'] },
  { canonical: 'aventurine',   aliases: ['aventurine'] },
  { canonical: 'onyx',         aliases: ['onyx', 'mã não đen'] },
  { canonical: 'agate',        aliases: ['agate', 'mã não', 'ma nao', 'chalcedony'] },
  { canonical: 'pearl',        aliases: ['ngọc trai', 'pearl'] },
  { canonical: 'coral',        aliases: ['san hô', 'coral'] },
  { canonical: 'amber',        aliases: ['hổ phách', 'amber'] },
  { canonical: 'turquoise',    aliases: ['turquoise', 'đá xanh thiên thanh'] },
]

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, '').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateStoneName
// ─────────────────────────────────────────────────────────────────────────────

export function validateStoneName(
  loai_da: string
): { isValid: boolean; corrected: string | null; canonical: string | null } {
  if (!loai_da?.trim()) return { isValid: false, corrected: 'Cần kiểm định', canonical: null }

  const normInput = norm(loai_da)
  if (
    normInput.includes('chua xac dinh') ||
    normInput.includes('khong xac dinh') ||
    normInput.includes('can kiem dinh')
  ) {
    return { isValid: true, corrected: null, canonical: 'unknown' }
  }

  for (const entry of STONE_WHITELIST) {
    if (normInput.includes(norm(entry.canonical))) {
      return { isValid: true, corrected: null, canonical: entry.canonical }
    }
    for (const alias of entry.aliases) {
      const na = norm(alias)
      if (na.length >= 3 && (normInput.includes(na) || na.includes(normInput))) {
        return { isValid: true, corrected: null, canonical: entry.canonical }
      }
    }
  }

  console.warn(`[ai-validator] Stone not in whitelist: "${loai_da}"`)
  return { isValid: false, corrected: null, canonical: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. validateColorConsistency — v5.1 FIX
//
// Vấn đề cũ: check toàn bộ chuỗi mau_sac dài → false positive
// Ví dụ: "xanh lá cây – xanh ngọc bích bão hòa, có độ ẩm hơi vàng nhẹ"
//         → chứa "vàng" nhưng đây là màu PHỤ mô tả tone, không phải màu chính
//
// Fix: chỉ lấy 40 ký tự ĐẦU của mau_sac (màu chủ đạo) để check
//      + thu hẹp invalidColors chỉ còn màu RÕ RÀNG sai (loại bỏ các màu mơ hồ)
// ─────────────────────────────────────────────────────────────────────────────

// Chỉ map những cặp màu CHẮC CHẮN sai — threshold cao hơn để tránh false positive
const STONE_COLOR_MAP: Record<string, { invalidColors: string[] }> = {
  // Ruby: không thể xanh hoặc xanh lá — nhưng có thể hồng, tím hồng, đỏ cam
  ruby: {
    invalidColors: ['xanh la', 'xanh luc', 'xanh duong dam', 'green', 'blue'],
  },
  // Emerald: không thể đỏ, tím đậm, xanh dương thuần — nhưng có thể vàng lục nhạt
  emerald: {
    invalidColors: ['do tuoi', 'tim dam', 'hong', 'red', 'purple'],
    // Bỏ 'vàng', 'blue', 'xanh dương' khỏi list vì Emerald có thể có tone vàng lục
    // và Haiku hay mô tả màu "xanh ngọc bích" — không phải xanh dương
  },
  // Sapphire: không thể xanh lá thuần
  sapphire: {
    invalidColors: ['xanh la cay thuan', 'do tuoi', 'cam tuoi'],
  },
  // Diamond: không thể đỏ đậm hay xanh lá đậm
  diamond: {
    invalidColors: ['do dam', 'xanh la dam'],
  },
  // Amethyst: không thể vàng hay xanh lá
  amethyst: {
    invalidColors: ['vang', 'xanh la'],
  },
  // Citrine: không thể tím hay xanh lá
  citrine: {
    invalidColors: ['tim', 'xanh la', 'do'],
  },
}

export function validateColorConsistency(
  loai_da: string,
  mau_sac: string
): { warning: string | null } {
  if (!loai_da || !mau_sac) return { warning: null }

  // Chỉ lấy 40 ký tự đầu — phần mô tả màu CHÍNH
  // Ví dụ: "Xanh lá cây – xanh ngọc bích bão hòa, có độ ẩm hơi vàng nhẹ ở một số viên"
  //         → lấy "Xanh lá cây – xanh ngọc bích b" → không có "vàng" → không false positive
  const primaryColor = norm(mau_sac.slice(0, 40))
  const normStone    = norm(loai_da)

  // Tìm canonical
  let canonical: string | null = null
  for (const entry of STONE_WHITELIST) {
    if (
      normStone.includes(norm(entry.canonical)) ||
      entry.aliases.some(a => norm(a).length >= 3 && normStone.includes(norm(a)))
    ) {
      canonical = entry.canonical
      break
    }
  }

  if (!canonical || !STONE_COLOR_MAP[canonical]) return { warning: null }

  const { invalidColors } = STONE_COLOR_MAP[canonical]
  const hasInvalid = invalidColors.some(ic => primaryColor.includes(norm(ic)))

  if (hasInvalid) {
    const warning = `Màu sắc chủ đạo "${mau_sac.slice(0, 60)}" không điển hình cho ${loai_da} — có thể nhầm loại đá, cần kiểm định thêm.`
    console.warn(`[ai-validator] Color inconsistency: ${loai_da} + ${mau_sac.slice(0, 60)}`)
    return { warning }
  }

  return { warning: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. validateHardnessAndClarity
// ─────────────────────────────────────────────────────────────────────────────

const HARDNESS_PATTERNS = [
  /\bmohs\b/i,
  /\b\d+(\.\d+)?\s*(mohs|độ cứng|hardness)\b/i,
  /\b(độ cứng|hardness)\s*\d/i,
  /^\s*\d+(\.\d+)?\s*[\/\-]\s*\d+\s*$/,
  /^\s*\d+(\.\d+)?\s*$/,
]

function mohs_to_clarity(mohs: number): string {
  if (mohs >= 9) return 'Trong suốt'
  if (mohs >= 7) return 'Nửa trong suốt'
  return 'Mờ đục'
}

export function validateHardnessAndClarity(do_trong: string): {
  isValid: boolean; corrected: string | null
} {
  if (!do_trong) return { isValid: true, corrected: null }
  const isHardness = HARDNESS_PATTERNS.some(p => p.test(do_trong))
  if (!isHardness) return { isValid: true, corrected: null }

  console.warn(`[ai-validator] do_trong looks like Mohs: "${do_trong}"`)
  const numMatch = do_trong.match(/(\d+(\.\d+)?)/)
  if (numMatch) {
    const mohs = parseFloat(numMatch[1])
    if (mohs >= 1 && mohs <= 10) return { isValid: false, corrected: mohs_to_clarity(mohs) }
  }
  return { isValid: false, corrected: 'Cần quan sát trực tiếp' }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. applyValidation — entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationReport {
  result: AIResult
  warnings: string[]
  stoneNameValid: boolean
  stoneCanonical: string | null
}

export function applyValidation(result: AIResult): ValidationReport {
  const warnings: string[] = []
  const corrected = { ...result }

  // 1. Validate tên đá
  const nameCheck = validateStoneName(result.loai_da)
  if (!nameCheck.isValid) {
    warnings.push(`Tên đá "${result.loai_da}" chưa được xác nhận trong danh sách — kết quả cần kiểm chứng.`)
    if (corrected.do_tin_cay > 60) {
      corrected.do_tin_cay = 60
      corrected.ly_do_tin_cay = `[Validator] Tên đá không trong whitelist → giới hạn 60%. ${corrected.ly_do_tin_cay}`
    }
  }

  // 2. Validate màu sắc vs loại đá (chỉ check màu chính 40 ký tự đầu)
  const colorCheck = validateColorConsistency(result.loai_da, result.mau_sac)
  if (colorCheck.warning) {
    warnings.push(colorCheck.warning)
    corrected.luu_y_khi_mua = corrected.luu_y_khi_mua
      ? `${corrected.luu_y_khi_mua} ⚠ ${colorCheck.warning}`
      : `⚠ ${colorCheck.warning}`
    if (corrected.do_tin_cay > 55) corrected.do_tin_cay = 55
  }

  // 3. Validate do_trong không bị nhầm Mohs
  const clarityCheck = validateHardnessAndClarity(result.do_trong)
  if (!clarityCheck.isValid && clarityCheck.corrected) {
    warnings.push(`Trường "Độ trong" có vẻ là độ cứng Mohs ("${result.do_trong}") — đã tự động chuyển thành mô tả độ trong suốt.`)
    corrected.do_trong = clarityCheck.corrected
  }

  if (warnings.length > 0) {
    console.log(`[ai-validator] ${warnings.length} warning(s) for "${result.loai_da}":`, warnings)
  }

  return {
    result: corrected,
    warnings,
    stoneNameValid: nameCheck.isValid,
    stoneCanonical: nameCheck.canonical,
  }
}
