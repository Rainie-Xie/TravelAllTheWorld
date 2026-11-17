// [IATA, 中文名, lat, lng, IANA tz, country]
const RAW = [
  ['HAN', '河内 内排国际机场', 21.2187, 105.8042, 'Asia/Ho_Chi_Minh', 'VN'],
  ['DAD', '岘港国际机场', 16.0439, 108.1994, 'Asia/Ho_Chi_Minh', 'VN'],
  ['CXR', '芽庄 金兰国际机场', 11.9982, 109.2194, 'Asia/Ho_Chi_Minh', 'VN'],
  ['SGN', '胡志明市 新山一国际机场', 10.8188, 106.6519, 'Asia/Ho_Chi_Minh', 'VN'],
  ['PQC', '富国岛国际机场', 10.1698, 103.9931, 'Asia/Ho_Chi_Minh', 'VN'],
  ['HUI', '顺化 富牌国际机场', 16.4015, 107.7026, 'Asia/Ho_Chi_Minh', 'VN'],
  ['DLI', '大叻 连姜机场', 11.75, 108.367, 'Asia/Ho_Chi_Minh', 'VN'],
  ['VDO', '下龙 云屯国际机场', 21.1178, 107.4142, 'Asia/Ho_Chi_Minh', 'VN'],
  ['PEK', '北京首都国际机场', 40.0799, 116.6031, 'Asia/Shanghai', 'CN'],
  ['PKX', '北京大兴国际机场', 39.5098, 116.4105, 'Asia/Shanghai', 'CN'],
  ['PVG', '上海浦东国际机场', 31.1443, 121.8083, 'Asia/Shanghai', 'CN'],
  ['SHA', '上海虹桥国际机场', 31.1979, 121.3363, 'Asia/Shanghai', 'CN'],
  ['CAN', '广州白云国际机场', 23.3924, 113.2988, 'Asia/Shanghai', 'CN'],
  ['SZX', '深圳宝安国际机场', 22.6393, 113.8107, 'Asia/Shanghai', 'CN'],
  ['CTU', '成都双流国际机场', 30.5785, 103.9471, 'Asia/Shanghai', 'CN'],
  ['TFU', '成都天府国际机场', 30.3125, 104.4442, 'Asia/Shanghai', 'CN'],
  ['CKG', '重庆江北国际机场', 29.7192, 106.6417, 'Asia/Shanghai', 'CN'],
  ['HGH', '杭州萧山国际机场', 30.2295, 120.4345, 'Asia/Shanghai', 'CN'],
  ['XMN', '厦门高崎国际机场', 24.544, 118.1277, 'Asia/Shanghai', 'CN'],
  ['KMG', '昆明长水国际机场', 24.9921, 102.7433, 'Asia/Shanghai', 'CN'],
  ['XIY', '西安咸阳国际机场', 34.4471, 108.7516, 'Asia/Shanghai', 'CN'],
  ['NKG', '南京禄口国际机场', 31.742, 118.862, 'Asia/Shanghai', 'CN'],
  ['WUH', '武汉天河国际机场', 30.7838, 114.2081, 'Asia/Shanghai', 'CN'],
  ['NNG', '南宁吴圩国际机场', 22.6083, 108.1722, 'Asia/Shanghai', 'CN'],
  ['HKG', '香港国际机场', 22.308, 113.9185, 'Asia/Hong_Kong', 'HK'],
  ['MFM', '澳门国际机场', 22.1496, 113.5916, 'Asia/Macau', 'MO'],
  ['TPE', '台北桃园国际机场', 25.0797, 121.2342, 'Asia/Taipei', 'TW'],
  ['NRT', '东京成田国际机场', 35.772, 140.3929, 'Asia/Tokyo', 'JP'],
  ['HND', '东京羽田机场', 35.5494, 139.7798, 'Asia/Tokyo', 'JP'],
  ['KIX', '大阪关西国际机场', 34.4347, 135.244, 'Asia/Tokyo', 'JP'],
  ['CTS', '札幌新千岁机场', 42.7752, 141.6923, 'Asia/Tokyo', 'JP'],
  ['OKA', '冲绳那霸机场', 26.1958, 127.6459, 'Asia/Tokyo', 'JP'],
  ['ICN', '首尔仁川国际机场', 37.4602, 126.4407, 'Asia/Seoul', 'KR'],
  ['CJU', '济州国际机场', 33.5113, 126.4928, 'Asia/Seoul', 'KR'],
  ['BKK', '曼谷素万那普机场', 13.69, 100.7501, 'Asia/Bangkok', 'TH'],
  ['DMK', '曼谷廊曼机场', 13.9126, 100.6067, 'Asia/Bangkok', 'TH'],
  ['HKT', '普吉国际机场', 8.1132, 98.3169, 'Asia/Bangkok', 'TH'],
  ['CNX', '清迈国际机场', 18.7668, 98.9626, 'Asia/Bangkok', 'TH'],
  ['SIN', '新加坡樟宜机场', 1.3644, 103.9915, 'Asia/Singapore', 'SG'],
  ['KUL', '吉隆坡国际机场', 2.7456, 101.7072, 'Asia/Kuala_Lumpur', 'MY'],
  ['DPS', '巴厘岛 伍拉·赖国际机场', -8.7482, 115.1672, 'Asia/Makassar', 'ID'],
  ['REP', '暹粒吴哥国际机场', 13.37, 104.22, 'Asia/Phnom_Penh', 'KH'],
  ['DXB', '迪拜国际机场', 25.2532, 55.3657, 'Asia/Dubai', 'AE'],
  ['IST', '伊斯坦布尔机场', 41.2753, 28.7519, 'Europe/Istanbul', 'TR'],
  ['CDG', '巴黎戴高乐机场', 49.0097, 2.5479, 'Europe/Paris', 'FR'],
  ['LHR', '伦敦希思罗机场', 51.47, -0.4543, 'Europe/London', 'GB'],
  ['FCO', '罗马菲乌米奇诺机场', 41.8003, 12.2389, 'Europe/Rome', 'IT'],
  ['ZRH', '苏黎世机场', 47.4582, 8.5555, 'Europe/Zurich', 'CH'],
  ['FRA', '法兰克福机场', 50.0379, 8.5622, 'Europe/Berlin', 'DE'],
  ['JFK', '纽约肯尼迪国际机场', 40.6413, -73.7781, 'America/New_York', 'US'],
  ['LAX', '洛杉矶国际机场', 33.9416, -118.4085, 'America/Los_Angeles', 'US'],
  ['SFO', '旧金山国际机场', 37.6213, -122.379, 'America/Los_Angeles', 'US'],
  ['SYD', '悉尼金斯福德·史密斯机场', -33.9399, 151.1753, 'Australia/Sydney', 'AU'],
  ['MEL', '墨尔本机场', -37.669, 144.841, 'Australia/Melbourne', 'AU'],
]

export const AIRPORTS = RAW.map(([code, name, lat, lng, tz, country]) => ({ code, name, lat, lng, tz, country }))

export function searchAirports(q) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return AIRPORTS.filter((a) => a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)).slice(0, 8)
}

export const COMMON_TZ = [
  'Asia/Shanghai', 'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
  'Asia/Kuala_Lumpur', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Makassar', 'Asia/Jakarta', 'Asia/Manila',
  'Asia/Phnom_Penh', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'Europe/Rome',
  'Europe/Berlin', 'Europe/Istanbul', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney',
  'Pacific/Auckland',
]
