// Popular cities: [zh name, english/local name, lat, lng, tags]
// tags: beach 海滩 / temple 寺庙 / mountain 山区 / city 城市
const RAW = {
  VN: [
    ['河内', 'Hanoi', 21.0285, 105.8542, 'city temple'], ['岘港', 'Da Nang', 16.0544, 108.2022, 'beach city'],
    ['芽庄', 'Nha Trang', 12.2388, 109.1967, 'beach'], ['胡志明市', 'Ho Chi Minh City', 10.7769, 106.7009, 'city'],
    ['会安', 'Hoi An', 15.8801, 108.338, 'city temple'], ['顺化', 'Hue', 16.4637, 107.5909, 'temple'],
    ['下龙湾', 'Ha Long', 20.9101, 107.1839, 'beach'], ['沙坝', 'Sa Pa', 22.3364, 103.8438, 'mountain'],
    ['富国岛', 'Phu Quoc', 10.2899, 103.984, 'beach'], ['大叻', 'Da Lat', 11.9404, 108.4583, 'mountain'],
    ['宁平', 'Ninh Binh', 20.2506, 105.9745, 'mountain temple'], ['美奈', 'Mui Ne', 10.9333, 108.2833, 'beach'],
  ],
  JP: [
    ['东京', 'Tokyo', 35.6762, 139.6503, 'city'], ['大阪', 'Osaka', 34.6937, 135.5023, 'city'],
    ['京都', 'Kyoto', 35.0116, 135.7681, 'temple'], ['奈良', 'Nara', 34.6851, 135.8048, 'temple'],
    ['札幌', 'Sapporo', 43.0618, 141.3545, 'city'], ['那霸（冲绳）', 'Naha', 26.2124, 127.6809, 'beach'],
    ['名古屋', 'Nagoya', 35.1815, 136.9066, 'city'], ['福冈', 'Fukuoka', 33.5904, 130.4017, 'city'],
    ['神户', 'Kobe', 34.6901, 135.1955, 'city'], ['箱根', 'Hakone', 35.2324, 139.1069, 'mountain'],
  ],
  TH: [
    ['曼谷', 'Bangkok', 13.7563, 100.5018, 'city temple'], ['清迈', 'Chiang Mai', 18.7883, 98.9853, 'temple mountain'],
    ['普吉岛', 'Phuket', 7.8804, 98.3923, 'beach'], ['芭提雅', 'Pattaya', 12.9236, 100.8825, 'beach'],
    ['苏梅岛', 'Koh Samui', 9.512, 100.0136, 'beach'], ['甲米', 'Krabi', 8.0863, 98.9063, 'beach'],
  ],
  KR: [
    ['首尔', 'Seoul', 37.5665, 126.978, 'city'], ['釜山', 'Busan', 35.1796, 129.0756, 'beach city'],
    ['济州岛', 'Jeju', 33.4996, 126.5312, 'beach mountain'], ['庆州', 'Gyeongju', 35.8562, 129.2247, 'temple'],
  ],
  SG: [['新加坡', 'Singapore', 1.3521, 103.8198, 'city']],
  MY: [
    ['吉隆坡', 'Kuala Lumpur', 3.139, 101.6869, 'city'], ['槟城', 'Penang', 5.4164, 100.3327, 'city'],
    ['亚庇（沙巴）', 'Kota Kinabalu', 5.9804, 116.0735, 'beach'], ['兰卡威', 'Langkawi', 6.35, 99.8, 'beach'],
  ],
  ID: [['巴厘岛', 'Bali', -8.3405, 115.092, 'beach temple'], ['雅加达', 'Jakarta', -6.2088, 106.8456, 'city']],
  PH: [['马尼拉', 'Manila', 14.5995, 120.9842, 'city'], ['宿务', 'Cebu', 10.3157, 123.8854, 'beach'], ['长滩岛', 'Boracay', 11.9674, 121.9248, 'beach']],
  CN: [
    ['北京', 'Beijing', 39.9042, 116.4074, 'city temple'], ['上海', 'Shanghai', 31.2304, 121.4737, 'city'],
    ['成都', 'Chengdu', 30.5728, 104.0668, 'city'], ['重庆', 'Chongqing', 29.563, 106.5516, 'city'],
    ['西安', 'Xian', 34.3416, 108.9398, 'city temple'], ['杭州', 'Hangzhou', 30.2741, 120.1551, 'city'],
    ['厦门', 'Xiamen', 24.4798, 118.0894, 'beach city'], ['三亚', 'Sanya', 18.2528, 109.5119, 'beach'],
    ['大理', 'Dali', 25.6065, 100.2676, 'mountain'], ['丽江', 'Lijiang', 26.8721, 100.2299, 'mountain'],
    ['广州', 'Guangzhou', 23.1291, 113.2644, 'city'], ['深圳', 'Shenzhen', 22.5431, 114.0579, 'city'],
    ['青岛', 'Qingdao', 36.0671, 120.3826, 'beach city'], ['哈尔滨', 'Harbin', 45.8038, 126.535, 'city'],
  ],
  HK: [['香港', 'Hong Kong', 22.3193, 114.1694, 'city']],
  MO: [['澳门', 'Macau', 22.1987, 113.5439, 'city']],
  TW: [['台北', 'Taipei', 25.033, 121.5654, 'city'], ['高雄', 'Kaohsiung', 22.6273, 120.3014, 'city'], ['花莲', 'Hualien', 23.9872, 121.6015, 'mountain beach'], ['台中', 'Taichung', 24.1477, 120.6736, 'city']],
  FR: [['巴黎', 'Paris', 48.8566, 2.3522, 'city'], ['尼斯', 'Nice', 43.7102, 7.262, 'beach'], ['里昂', 'Lyon', 45.764, 4.8357, 'city']],
  IT: [['罗马', 'Rome', 41.9028, 12.4964, 'city temple'], ['米兰', 'Milan', 45.4642, 9.19, 'city'], ['佛罗伦萨', 'Florence', 43.7696, 11.2558, 'city temple'], ['威尼斯', 'Venice', 45.4408, 12.3155, 'city']],
  GB: [['伦敦', 'London', 51.5074, -0.1278, 'city'], ['爱丁堡', 'Edinburgh', 55.9533, -3.1883, 'city']],
  ES: [['巴塞罗那', 'Barcelona', 41.3874, 2.1686, 'beach city'], ['马德里', 'Madrid', 40.4168, -3.7038, 'city']],
  CH: [['苏黎世', 'Zurich', 47.3769, 8.5417, 'city'], ['因特拉肯', 'Interlaken', 46.6863, 7.8632, 'mountain'], ['卢塞恩', 'Lucerne', 47.0502, 8.3093, 'mountain']],
  US: [['纽约', 'New York', 40.7128, -74.006, 'city'], ['洛杉矶', 'Los Angeles', 34.0522, -118.2437, 'beach city'], ['旧金山', 'San Francisco', 37.7749, -122.4194, 'city'], ['拉斯维加斯', 'Las Vegas', 36.1699, -115.1398, 'city'], ['檀香山', 'Honolulu', 21.3069, -157.8583, 'beach']],
  AU: [['悉尼', 'Sydney', -33.8688, 151.2093, 'beach city'], ['墨尔本', 'Melbourne', -37.8136, 144.9631, 'city'], ['凯恩斯', 'Cairns', -16.9186, 145.7781, 'beach']],
  NZ: [['奥克兰', 'Auckland', -36.8485, 174.7633, 'city'], ['皇后镇', 'Queenstown', -45.0312, 168.6626, 'mountain']],
  AE: [['迪拜', 'Dubai', 25.2048, 55.2708, 'city'], ['阿布扎比', 'Abu Dhabi', 24.4539, 54.3773, 'city temple']],
  TR: [['伊斯坦布尔', 'Istanbul', 41.0082, 28.9784, 'city temple'], ['卡帕多奇亚', 'Cappadocia', 38.6431, 34.8289, 'mountain']],
  EG: [['开罗', 'Cairo', 30.0444, 31.2357, 'city temple'], ['卢克索', 'Luxor', 25.6872, 32.6396, 'temple']],
  MV: [['马累', 'Male', 4.1755, 73.5093, 'beach']],
  KH: [['暹粒（吴哥窟）', 'Siem Reap', 13.3671, 103.8448, 'temple'], ['金边', 'Phnom Penh', 11.5564, 104.9282, 'city temple']],
  LA: [['琅勃拉邦', 'Luang Prabang', 19.8856, 102.1347, 'temple'], ['万象', 'Vientiane', 17.9757, 102.6331, 'city']],
}

export const POPULAR_CITIES = Object.fromEntries(
  Object.entries(RAW).map(([cc, list]) => [
    cc,
    list.map(([name, en, lat, lng, tags]) => ({ name, en, lat, lng, tags: tags.split(' ') })),
  ]),
)

export const TAGS = {
  beach: { label: '海滩', emoji: '🏖️' },
  temple: { label: '寺庙/宗教', emoji: '🛕' },
  mountain: { label: '山区/徒步', emoji: '⛰️' },
  city: { label: '城市漫游', emoji: '🏙️' },
}
