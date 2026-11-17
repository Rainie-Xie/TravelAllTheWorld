import { uid } from './util'
import { daysBetween } from './time'
import { plugOf, countryName } from '../data/countries'

export const CATEGORIES = [
  { key: 'docs', label: '证件', emoji: '🛂' },
  { key: 'money', label: '钱与卡', emoji: '💳' },
  { key: 'tech', label: '电子产品', emoji: '🔌' },
  { key: 'clothes', label: '衣物鞋包', emoji: '👕' },
  { key: 'wash', label: '洗护', emoji: '🧴' },
  { key: 'med', label: '药品', emoji: '💊' },
  { key: 'beach', label: '海滩 / 户外', emoji: '🏖️' },
  { key: 'misc', label: '出行小物', emoji: '🎒' },
  { key: 'custom', label: '其他', emoji: '✨' },
]

const BASE = [
  ['passport', '护照（有效期 6 个月以上）', 'docs', 1, true],
  ['idcard', '身份证', 'docs', 1, true],
  ['booking', '机票 / 酒店订单截图（离线保存）', 'docs', 1, true],
  ['insurance', '旅行保险单', 'docs', 1, true],
  ['photo', '2 寸证件照 + 护照复印件', 'docs', 1, false],
  ['cash', '当地现金（少量）', 'money', 1, true],
  ['card', 'Visa / Master 信用卡', 'money', 1, true],
  ['phone', '手机 + 充电线', 'tech', 1, true],
  ['powerbank', '充电宝（必须随身，不能托运）', 'tech', 1, true],
  ['charger', '充电头（多口快充）', 'tech', 1, false],
  ['sim', '当地电话卡 / eSIM', 'tech', 1, true],
  ['earphone', '耳机', 'tech', 1, true],
  ['underwear', '内衣裤', 'clothes', 0, false],
  ['socks', '袜子', 'clothes', 0, false],
  ['sleep', '睡衣', 'clothes', 1, false],
  ['shoes', '一双好走的鞋', 'clothes', 1, false],
  ['bag', '随身斜挎包 / 防盗包', 'clothes', 1, false],
  ['tooth', '牙刷牙膏', 'wash', 1, false],
  ['skincare', '护肤品小样（液体 ≤100ml）', 'wash', 1, false],
  ['tissue', '纸巾 / 湿巾', 'wash', 2, true],
  ['razor', '剃须刀 / 化妆品', 'wash', 1, false],
  ['medcold', '感冒药、退烧药', 'med', 1, false],
  ['medstomach', '肠胃药（止泻、益生菌）', 'med', 1, false],
  ['bandaid', '创可贴', 'med', 1, false],
  ['bottle', '水杯', 'misc', 1, true],
  ['pen', '笔（填入境卡）', 'misc', 1, true],
  ['umbrella0', '折叠伞', 'misc', 1, false],
]

const item = (key, name, category, qty = 1, carryOn = false, source = 'template') => ({
  id: uid(), key, name, category, qty, carryOn, checked: false, source,
})

/**
 * Generates suggestions. weatherByCity: { [cityId]: dayWeather[] }
 */
export function suggestPacking(trip, weatherByCity = {}, settings) {
  const days = trip.startDate && trip.endDate ? daysBetween(trip.startDate, trip.endDate) + 1 : 5
  const outfits = Math.min(days, days > 7 ? 6 : days)
  const list = []
  for (const [key, name, cat, qty, carry] of BASE) {
    if (key === 'idcard' && trip.cities.every((c) => c.countryCode === settings.homeCountry)) continue
    if (key === 'passport' && trip.cities.every((c) => c.countryCode === settings.homeCountry)) continue
    list.push(item(key, name, cat, qty || outfits, carry))
  }
  list.push(item('tops', `上衣 ×${outfits}${days > 7 ? '（中途洗衣）' : ''}`, 'clothes', outfits))
  list.push(item('bottoms', `下装 ×${Math.max(2, Math.ceil(outfits / 2))}`, 'clothes', Math.max(2, Math.ceil(outfits / 2))))
  if (days > 7) list.push(item('laundry', '洗衣袋 / 洗衣凝珠', 'wash', 1))

  // weather-driven
  const all = Object.values(weatherByCity).flat().filter((d) => d?.tmax != null)
  if (all.length) {
    const hi = Math.max(...all.map((d) => d.tmax))
    const lo = Math.min(...all.map((d) => d.tmin))
    const rainy = all.some((d) => (d.rain ?? 0) >= 50 || (d.precip ?? 0) >= 5)
    const strongSun = all.some((d) => (d.uv ?? (d.tmax >= 28 ? 8 : 0)) >= 6)
    const w = (k, n, c, q = 1, carry = false) => list.push(item(k, n, c, q, carry, 'weather'))
    if (hi >= 27) { w('shorts', '短裤 / 薄裙', 'clothes', 2); w('sandal', '凉鞋 / 拖鞋', 'clothes') }
    if (lo <= 18) w('jacket', `薄外套（最低 ${Math.round(lo)}°）`, 'clothes', 1, true)
    if (lo <= 8) { w('down', `羽绒服 / 厚外套（最低 ${Math.round(lo)}°）`, 'clothes'); w('scarf', '围巾、帽子、手套', 'clothes') }
    if (rainy) { w('raincoat', '轻便雨衣 / 雨伞', 'misc', 1, true); w('waterproof', '防水手机袋', 'misc') }
    if (strongSun) { w('sunscreen', '防晒霜 SPF50+', 'wash', 1); w('sunglasses', '墨镜', 'misc', 1, true); w('hat', '遮阳帽', 'clothes'); w('aloe', '晒后修复（芦荟胶）', 'wash') }
    if (hi >= 30) w('fan', '手持小风扇', 'misc', 1, true)
    if (hi >= 28) w('mosquito', '驱蚊液', 'med')
  }

  // destination-driven
  const tags = new Set(trip.cities.flatMap((c) => c.tags || []))
  const d = (k, n, c, q = 1, carry = false) => list.push(item(k, n, c, q, carry, 'destination'))
  if (tags.has('beach')) {
    d('swim', '泳衣', 'beach'); d('flipflop', '沙滩拖鞋', 'beach'); d('snorkel', '浮潜面镜（可选）', 'beach'); d('drybag', '防水袋', 'beach')
  }
  if (tags.has('temple')) d('shawl', '披肩 / 长裙（进寺庙遮肩膝）', 'clothes')
  if (tags.has('mountain')) { d('fleece', '抓绒 / 冲锋衣', 'clothes'); d('hikingshoe', '防滑徒步鞋', 'clothes') }

  const home = plugOf(settings.homeCountry)
  const countries = [...new Set(trip.cities.map((c) => c.countryCode))].filter((c) => c !== settings.homeCountry)
  for (const cc of countries) {
    const p = plugOf(cc)
    if (!p) { d(`plug-${cc}`, `${countryName(cc)}：万能转换插头`, 'tech'); continue }
    const needs = home && !p.types.some((t) => home.types.includes(t))
    const volt = home && Math.abs(p.volt - home.volt) > 40 ? `，电压 ${p.volt}V 注意电器` : ''
    d(`plug-${cc}`, `${countryName(cc)}插座 ${p.types.join('/')} 型：${needs ? '需要转换插头' : '国标两扁脚可用，带个万能转换头更保险'}${volt}`, 'tech')
  }
  if (countries.length) d('visa', '签证 / 电子签打印件', 'docs', 1, true)
  if (trip.transports.some((t) => t.type === 'flight')) {
    d('neckpillow', 'U 型枕 / 眼罩', 'misc', 1, true)
    d('liquids', '液体单瓶 ≤100ml，装透明袋', 'wash', 1, true)
  }
  return list
}

// adds suggestions whose key is not yet present
export function mergePacking(existing, suggested) {
  const keys = new Set(existing.map((i) => i.key).filter(Boolean))
  return [...existing, ...suggested.filter((s) => !keys.has(s.key))]
}
