import countries from 'i18n-iso-countries'
import zh from 'i18n-iso-countries/langs/zh.json'
import en from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(zh)
countries.registerLocale(en)

const zhNames = countries.getNames('zh', { select: 'official' })
const OVERRIDES = { TW: '中国台湾', HK: '中国香港', MO: '中国澳门', KR: '韩国', KP: '朝鲜', US: '美国', GB: '英国', RU: '俄罗斯', VN: '越南', LA: '老挝' }

export const countryName = (code) => OVERRIDES[code] || zhNames[code] || code

export function flag(code) {
  if (!code || code.length !== 2) return '🏳️'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

export const numericToAlpha2 = (n) => countries.numericToAlpha2(String(n).padStart(3, '0'))

const CONTINENT_LISTS = {
  亚洲: 'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO',
  欧洲: 'AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR HU IS IE IM IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA AX GG JE SJ',
  非洲: 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  北美洲: 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  南美洲: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
  大洋洲: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
  南极洲: 'AQ TF HM BV GS',
}
const CONTINENT = {}
for (const [k, v] of Object.entries(CONTINENT_LISTS)) for (const c of v.split(' ')) CONTINENT[c] = k
export const continentOf = (code) => CONTINENT[code] || '其他'
export const CONTINENTS = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '南极洲']

const CURRENCY = {
  CN: 'CNY', VN: 'VND', JP: 'JPY', KR: 'KRW', TH: 'THB', SG: 'SGD', MY: 'MYR', ID: 'IDR', PH: 'PHP',
  HK: 'HKD', MO: 'MOP', TW: 'TWD', IN: 'INR', KH: 'KHR', LA: 'LAK', MM: 'MMK', NP: 'NPR', LK: 'LKR', MV: 'MVR',
  AE: 'AED', TR: 'TRY', US: 'USD', CA: 'CAD', MX: 'MXN', GB: 'GBP', CH: 'CHF', AU: 'AUD', NZ: 'NZD',
  RU: 'RUB', EG: 'EGP', ZA: 'ZAR', BR: 'BRL', AR: 'ARS', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK',
  CZ: 'CZK', HU: 'HUF', PL: 'PLN', MA: 'MAD', GE: 'GEL', KZ: 'KZT', UZ: 'UZS', MN: 'MNT', SA: 'SAR', QA: 'QAR',
}
const EURO = 'AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES MC SM VA AD ME XK'.split(' ')
export const currencyOf = (code) => (EURO.includes(code) ? 'EUR' : CURRENCY[code] || 'USD')

export const CURRENCY_NAMES = {
  CNY: '人民币', USD: '美元', EUR: '欧元', JPY: '日元', KRW: '韩元', VND: '越南盾', THB: '泰铢', SGD: '新加坡元',
  MYR: '马来西亚林吉特', IDR: '印尼盾', PHP: '菲律宾比索', HKD: '港币', MOP: '澳门元', TWD: '新台币', GBP: '英镑',
  AUD: '澳元', NZD: '新西兰元', CAD: '加元', CHF: '瑞士法郎', AED: '迪拉姆', TRY: '土耳其里拉', INR: '印度卢比',
  KHR: '柬埔寨瑞尔', LAK: '老挝基普', RUB: '卢布', MXN: '墨西哥比索', EGP: '埃及镑',
}

// plug types & voltage (subset; default treated as unknown)
const PLUGS = {
  CN: ['A I C', 220], VN: ['A C D', 220], JP: ['A B', 100], KR: ['C F', 220], TH: ['A B C O', 220],
  SG: ['G', 230], MY: ['G', 240], ID: ['C F', 230], PH: ['A B C', 220], HK: ['G', 220], MO: ['G D', 220],
  TW: ['A B', 110], IN: ['C D M', 230], KH: ['A C G', 230], LA: ['A B C E F', 230], US: ['A B', 120],
  CA: ['A B', 120], MX: ['A B', 127], GB: ['G', 230], IE: ['G', 230], AU: ['I', 230], NZ: ['I', 230],
  CH: ['C J', 230], IT: ['C F L', 230], AE: ['G', 230], TR: ['C F', 230], RU: ['C F', 220], EG: ['C F', 220],
  ZA: ['C D M N', 230], BR: ['C N', 127], MV: ['D G', 230], LK: ['D G', 230], NP: ['C D M', 230],
}
export function plugOf(code) {
  if (PLUGS[code]) return { types: PLUGS[code][0].split(' '), volt: PLUGS[code][1] }
  if (EURO.includes(code) || CONTINENT[code] === '欧洲') return { types: ['C', 'F'], volt: 230 }
  return null
}

export const POPULAR = ['VN', 'JP', 'TH', 'KR', 'SG', 'MY', 'ID', 'CN', 'HK', 'MO', 'TW', 'FR', 'IT', 'GB', 'ES', 'CH', 'US', 'AU', 'NZ', 'AE', 'TR', 'EG', 'MV', 'PH']

export const ALL_COUNTRIES = Object.keys(zhNames)
  .filter((c) => !['AQ', 'BV', 'HM', 'UM', 'TF'].includes(c))
  .map((code) => ({ code, name: countryName(code), en: countries.getName(code, 'en') || code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
