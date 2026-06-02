// lib/ai-validator.ts
// Validation layer — chạy SAU khi nhận kết quả AI, TRƯỚC khi lưu DB
// Không throw error, chỉ correct/warn để không block luồng chính

import type { AIResult } from './ai-panel'

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist 20+ loại đá thật — dùng để detect hallucination tên đá kỳ lạ
// ─────────────────────────────────────────────────────────────────────────────

// Mỗi entry: [tên khoa học ASCII, ...alias tiếng Việt / biến thể thường gặp]
const STONE_WHITELIST: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'emerald',       aliases: ['ngọc lục bảo', 'ngoc luc bao', 'beryl xanh', 'emerald'] },
  { canonical: 'ruby',          aliases: ['hồng ngọc', 'hong ngoc', 'ruby', 'corundum đỏ'] },
  { canonical: 'sapphire',      aliases: ['lam ngọc', 'lam ngoc', 'saphia', 'sapphire', 'corundum xanh'] },
  { canonical: 'jadeite',       aliases: ['phỉ thúy', 'phi thuy', 'jadeite', 'jade loại a', 'jade type a', 'ngọc phỉ thúy'] },
  { canonical: 'nephrite',      aliases: ['ngọc bích', 'ngoc bich', 'nephrite', 'jade loại b', 'canadian jade'] },
  { canonical: 'diamond',       aliases: ['kim cương', 'kim cuong', 'diamond'] },
  { canonical: 'quartz',        aliases: ['thạch anh', 'thach anh', 'quartz', 'crystal', 'pha lê', 'pha le'] },
  { canonical: 'amethyst',      aliases: ['thạch anh tím', 'thach anh tim', 'amethyst'] },
  { canonical: 'citrine',       aliases: ['thạch anh vàng', 'thach anh vang', 'citrine'] },
  { canonical: 'topaz',         aliases: ['topaz', 'hoàng ngọc', 'hoang ngoc', 'blue topaz'] },
  { canonical: 'tourmaline',    aliases: ['tourmaline', 'điện khí thạch', 'dien khi thach', 'rubellite'] },
  { canonical: 'garnet',        aliases: ['garnet', 'thạch lựu', 'thach luu', 'pyrope', 'almandine'] },
  { canonical: 'opal',          aliases: ['opal', 'đá mắt mèo opal'] },
  { canonical: 'aquamarine',    aliases: ['aquamarine', 'ngọc lam', 'ngoc lam', 'beryl xanh lam'] },
  { canonical: 'peridot',       aliases: ['peridot', 'olivine', 'ngọc xanh lá nhạt'] },
  { canonical: 'lapis lazuli',  aliases: ['lapis lazuli', 'đá lapis', 'da lapis', 'thanh kim thạch'] },
  { canonical: 'tanzanite',     aliases: ['tanzanite', 'đá tanzanit'] },
  { canonical: 'spinel',        aliases: ['spinel', 'hồng bảo thạch giả', 'red spinel', 'blue spinel'] },
  { canonical: 'fluorite',      aliases: ['fluorite', 'fluorite', 'canxi florua'] },
  { canonical: 'iolite',        aliases: ['iolite', 'đá iolite', 'cordierite'] },
  { canonical: 'kyanite',       aliases: ['kyanite', 'đá kyanite'] },
  { canonical: 'moonstone',     aliases: ['đá mặt trăng', 'da mat trang', 'moonstone', 'orthoclase'] },
  { canonical: 'malachite',     aliases: ['malachite', 'khổng tước thạch', 'đá malachit'] },
  { canonical: 'labradorite',   aliases: ['labradorite', 'đá labradorit'] },
  { canonical: 'rhodonite',     aliases: ['rhodonite', 'đá rhodonit'] },
  { canonical: 'chrysoprase',   aliases: ['chrysoprase', 'đá chrysoprase'] },
  { canonical: 'serpentine',    aliases: ['serpentine', 'đá serpentin', 'jade giả serpentine'] },
  { canonical: 'aventurine',    aliases: ['aventurine', 'đá aventurine'] },
  { canonical: 'onyx',          aliases: ['onyx', 'đá mã não đen', 'mã não đen'] },
  { canonical: 'agate',         aliases: ['agate', 'mã não', 'ma nao', 'chalcedony'] },
  { canonical: 'pearl',         aliases: ['ngọc trai', 'ngoc trai', 'pearl'] },
  { canonical: 'coral',         aliases: ['san hô', 'san ho', 'coral đỏ'] },
  { canonical: 'amber',         aliases: ['hổ phách', 'ho phach', 'amber', 'baltic amber'] },
  { canonical: 'turquoise',     aliases: ['turquoise', 'ngọc lam hổ', 'đá xanh thiên thanh'] },
]

// Helper: normalize string để so sánh
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateStoneName
// ─────────────────────────────────────────────────────────────────────────────

export function validateStoneName(
  loai_da: string
): { isValid: boolean; corrected: string | null; canonical: string | null } {
  if (!loai_da || loai_da.trim() === '') {
    return { isValid: false, corrected: 'Cần kiểm định', canonical: null }
  }

  // Bypass: "Chưa xác định" là hợp lệ — AI đã honest
  const normInput = norm(loai_da)
  if (normInput.includes('chua xac dinh') || normInput.includes('khong xac dinh') || normInput.includes('can kiem dinh')) {
    return { isValid: true, corrected: null, canonical: 'unknown' }
  }

  // Tìm match trong whitelist
  for (const entry of STONE_WHITELIST) {
    // Match canonical
    if (normInput.includes(norm(entry.canonical))) {
      return { isValid: true, corrected: null, canonical: entry.canonical }
    }
    // Match alias
    for (const alias of entry.aliases) {
      if (normInput.includes(norm(alias)) || norm(alias).includes(normInput)) {
        return { isValid: true, corrected: null, canonical: entry.canonical }
      }
    }
  }

  // Không match whitelist → nghi hallucination
  // Nhưng không block hoàn toàn: có thể là đá hiếm hợp lệ
  // Strategy: flag warning, không replace tên
  console.warn(`[ai-validator] Stone not in whitelist: "${loai_da}" — possible hallucination`)
  return { isValid: false, corrected: null, canonical: null }
  // Note: caller quyết định có dùng corrected hay không
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. validateColorConsistency
// Kiểm tra màu sắc có hợp lý với loại đá không
// ─────────────────────────────────────────────────────────────────────────────

// Map: canonical stone → màu HỢP LỆ (keywords)
const STONE_COLOR_MAP: Record<string, { validColors: string[]; invalidColors: string[] }> = {
  ruby:       { validColors: ['đỏ', 'hồng', 'đỏ cam', 'đỏ tím', 'red', 'pink', 'crimson', 'pigeon'],  invalidColors: ['xanh lam', 'xanh lục', 'xanh dương', 'vàng', 'tím đậm', 'blue', 'green'] },
  emerald:    { validColors: ['xanh lục', 'xanh lá', 'green', 'lục'],                                   invalidColors: ['đỏ', 'xanh dương', 'tím', 'vàng', 'blue', 'red', 'purple'] },
  sapphire:   { validColors: ['xanh dương', 'xanh lam', 'blue', 'tím', 'hồng', 'vàng', 'không màu'],  invalidColors: ['đỏ', 'xanh lục', 'green', 'đỏ tươi'] },
  // Ruby đỏ đã có, Sapphire xanh — Corundum màu khác là Padparadscha, không list hết
  diamond:    { validColors: ['không màu', 'trắng', 'colorless', 'vàng nhạt', 'xanh nhạt', 'hồng nhạt'], invalidColors: ['đỏ đậm', 'xanh lục đậm'] },
  amethyst:   { validColors: ['tím', 'purple', 'violet'],                                                 invalidColors: ['đỏ', 'xanh dương đậm', 'vàng', 'green'] },
  citrine:    { validColors: ['vàng', 'cam', 'yellow', 'orange'],                                        invalidColors: ['tím', 'xanh dương', 'đỏ', 'blue'] },
  aquamarine: { validColors: ['xanh lam nhạt', 'xanh ngọc', 'blue', 'xanh dương nhạt', 'cyan'],         invalidColors: ['đỏ', 'vàng đậm', 'tím đậm'] },
}

export function validateColorConsistency(
  loai_da: string,
  mau_sac: string
): { warning: string | null } {
  if (!loai_da || !mau_sac) return { warning: null }

  const normStone = norm(loai_da)
  const normColor = norm(mau_sac)

  // Tìm canonical
  let canonical: string | null = null
  for (const entry of STONE_WHITELIST) {
    if (normStone.includes(norm(entry.canonical)) ||
        entry.aliases.some(a => normStone.includes(norm(a)))) {
      canonical = entry.canonical
      break
    }
  }

  if (!canonical || !STONE_COLOR_MAP[canonical]) return { warning: null }

  const { invalidColors } = STONE_COLOR_MAP[canonical]

  const hasInvalidColor = invalidColors.some(ic => normColor.includes(norm(ic)))
  if (hasInvalidColor) {
    const warning = `Màu sắc "${mau_sac}" không điển hình cho ${loai_da}. Có thể nhầm loại đá hoặc đây là biến thể hiếm — cần kiểm định thêm.`
    console.warn(`[ai-validator] Color inconsistency: ${loai_da} + ${mau_sac}`)
    return { warning }
  }

  return { warning: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. validateHardnessAndClarity
// Kiểm tra do_trong có bị nhầm thành độ cứng Mohs không
// ─────────────────────────────────────────────────────────────────────────────

// Pattern nhận biết: "7.5", "8 Mohs", "9/10", "Mohs 7"
const HARDNESS_PATTERNS = [
  /\bmohs\b/i,
  /\b\d+(\.\d+)?\s*(mohs|độ cứng|hardness)\b/i,
  /\b(độ cứng|hardness)\s*\d/i,
  /^\s*\d+(\.\d+)?\s*[\/\-]\s*\d+\s*$/,  // "7/10" hoặc "7-8" thuần số
  /^\s*\d+(\.\d+)?\s*$/,                  // chỉ là số thuần như "8.5"
]

// Mapping từ số Mohs sang mô tả độ trong (rough heuristic)
function mohs_to_clarity(mohs: number): string {
  // Không có mapping tuyến tính thực sự, nhưng cần trả về mô tả hợp lý
  if (mohs >= 9) return 'Trong suốt'       // Corundum, Diamond thường trong
  if (mohs >= 7) return 'Nửa trong suốt'   // Quartz, Emerald range
  return 'Mờ đục'
}

export function validateHardnessAndClarity(do_trong: string): {
  isValid: boolean
  corrected: string | null
} {
  if (!do_trong) return { isValid: true, corrected: null }

  const isHardnessValue = HARDNESS_PATTERNS.some(p => p.test(do_trong))
  if (!isHardnessValue) return { isValid: true, corrected: null }

  console.warn(`[ai-validator] do_trong looks like Mohs hardness: "${do_trong}" — correcting`)

  // Thử extract số Mohs để map sang clarity
  const numMatch = do_trong.match(/(\d+(\.\d+)?)/)
  if (numMatch) {
    const mohs = parseFloat(numMatch[1])
    if (mohs >= 1 && mohs <= 10) {
      return { isValid: false, corrected: mohs_to_clarity(mohs) }
    }
  }

  // Fallback generic
  return { isValid: false, corrected: 'Cần quan sát trực tiếp' }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. applyValidation — entry point chính gọi trong route.ts
// Nhận 1 AIResult, trả về AIResult đã được correct + warnings tổng hợp
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
    // Không thay tên — giữ nguyên để không mất thông tin, chỉ log + warn
    warnings.push(`Tên đá "${result.loai_da}" không nằm trong danh sách đã biết — kết quả có thể cần kiểm chứng.`)
    // Giảm confidence nếu tên không nhận ra
    if (corrected.do_tin_cay > 60) {
      corrected.do_tin_cay = Math.min(corrected.do_tin_cay, 60)
      corrected.ly_do_tin_cay = `[Validator] Tên đá không trong whitelist → giới hạn confidence 60%. ${corrected.ly_do_tin_cay}`
    }
  }

  // 2. Validate màu sắc vs loại đá
  const colorCheck = validateColorConsistency(result.loai_da, result.mau_sac)
  if (colorCheck.warning) {
    warnings.push(colorCheck.warning)
    // Append vào luu_y_khi_mua để user thấy
    corrected.luu_y_khi_mua = corrected.luu_y_khi_mua
      ? `${corrected.luu_y_khi_mua} ⚠ ${colorCheck.warning}`
      : `⚠ ${colorCheck.warning}`
    // Cũng giảm confidence
    if (corrected.do_tin_cay > 55) {
      corrected.do_tin_cay = Math.min(corrected.do_tin_cay, 55)
    }
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
