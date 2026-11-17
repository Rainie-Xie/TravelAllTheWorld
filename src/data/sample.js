import { uid } from '../lib/util'
import { addDays, todayStr } from '../lib/time'

// A Vietnam sample trip (河内 → 岘港 → 芽庄 → 胡志明) to explore the app
export function makeSampleTrip() {
  const s = addDays(todayStr(), 5)
  const d = (n) => addDays(s, n)
  const P = (name, lat, lng, type = 'sight', extra = {}) => ({ id: uid(), name, lat, lng, type, priority: 'must', stay: 60, day: null, ...extra })

  const hanoi = {
    id: uid(), countryCode: 'VN', name: '河内', en: 'Hanoi', lat: 21.0285, lng: 105.8542, arrive: d(0), leave: d(3), tags: ['city', 'temple'], dayPlans: {},
    places: [
      P('老城区精品酒店（示例）', 21.034, 105.85, 'hotel', { hotelIn: d(0), hotelOut: d(3), localAddress: 'Hàng Bạc, Hoàn Kiếm, Hà Nội' }),
      P('还剑湖', 21.0287, 105.8524, 'sight', { stay: 45 }),
      P('河内大教堂', 21.0287, 105.8489, 'sight', { stay: 30 }),
      P('火车街', 21.0305, 105.8445, 'sight', { stay: 45, priority: 'optional' }),
      P('文庙', 21.0277, 105.8355, 'sight', { stay: 75, open: '08:00', close: '17:00' }),
      P('胡志明陵', 21.0368, 105.8346, 'sight', { stay: 60, open: '07:30', close: '10:30' }),
      P('一柱寺', 21.0359, 105.8336, 'sight', { stay: 20 }),
      P('镇国寺', 21.048, 105.8368, 'sight', { stay: 30 }),
      P('同春市场', 21.0382, 105.8496, 'shop', { stay: 60, priority: 'optional' }),
      P('河内歌剧院', 21.0243, 105.8575, 'sight', { stay: 20, priority: 'optional' }),
      P('越南民族学博物馆', 21.0405, 105.7986, 'sight', { stay: 120, open: '08:30', close: '17:30' }),
      P('Pho Gia Truyen 牛肉粉', 21.0335, 105.8467, 'food', { stay: 40 }),
      P('Cafe Giang 鸡蛋咖啡', 21.0334, 105.8547, 'cafe', { stay: 40 }),
    ],
  }
  const danang = {
    id: uid(), countryCode: 'VN', name: '岘港', en: 'Da Nang', lat: 16.0544, lng: 108.2022, arrive: d(3), leave: d(6), tags: ['beach', 'city'], dayPlans: {},
    places: [
      P('美溪海滩酒店（示例）', 16.061, 108.246, 'hotel', { hotelIn: d(3), hotelOut: d(6) }),
      P('美溪海滩', 16.0614, 108.2475, 'sight', { stay: 120 }),
      P('龙桥', 16.0611, 108.2272, 'sight', { stay: 30, priority: 'optional' }),
      P('山茶半岛灵应寺', 16.1003, 108.2778, 'sight', { stay: 60 }),
      P('五行山', 16.0036, 108.2638, 'sight', { stay: 90, open: '07:00', close: '17:30' }),
      P('韩市场', 16.0682, 108.224, 'shop', { stay: 45, priority: 'optional' }),
      P('粉红教堂', 16.0669, 108.2233, 'sight', { stay: 20 }),
      P('巴拿山', 15.9977, 107.9886, 'sight', { stay: 300 }),
      P('会安古镇', 15.877, 108.326, 'sight', { stay: 240 }),
    ],
  }
  const nhatrang = {
    id: uid(), countryCode: 'VN', name: '芽庄', en: 'Nha Trang', lat: 12.2388, lng: 109.1967, arrive: d(6), leave: d(9), tags: ['beach'], dayPlans: {},
    places: [
      P('海景酒店（示例）', 12.242, 109.196, 'hotel', { hotelIn: d(6), hotelOut: d(9) }),
      P('婆那加占婆塔', 12.2655, 109.1953, 'sight', { stay: 60 }),
      P('芽庄大教堂', 12.2468, 109.1878, 'sight', { stay: 30 }),
      P('珍珠岛乐园', 12.219, 109.24, 'sight', { stay: 300 }),
      P('芽庄海滩', 12.238, 109.197, 'sight', { stay: 120 }),
      P('I-Resort 泥浆浴', 12.2896, 109.1774, 'sight', { stay: 150, priority: 'optional' }),
    ],
  }
  const hcmc = {
    id: uid(), countryCode: 'VN', name: '胡志明市', en: 'Ho Chi Minh City', lat: 10.7769, lng: 106.7009, arrive: d(9), leave: d(12), tags: ['city'], dayPlans: {},
    places: [
      P('第一郡酒店（示例）', 10.774, 106.703, 'hotel', { hotelIn: d(9), hotelOut: d(12) }),
      P('红教堂', 10.7798, 106.699, 'sight', { stay: 30 }),
      P('中央邮局', 10.7799, 106.7, 'sight', { stay: 30 }),
      P('统一宫', 10.777, 106.6953, 'sight', { stay: 90, open: '08:00', close: '16:00' }),
      P('滨城市场', 10.7725, 106.698, 'shop', { stay: 60 }),
      P('战争遗迹博物馆', 10.7795, 106.6921, 'sight', { stay: 90, open: '07:30', close: '17:30' }),
      P('范五老街', 10.7672, 106.693, 'food', { stay: 90, priority: 'optional' }),
    ],
  }
  const ap = {
    PVG: { name: '上海浦东国际机场', code: 'PVG', lat: 31.1443, lng: 121.8083, tz: 'Asia/Shanghai' },
    HAN: { name: '河内 内排国际机场', code: 'HAN', lat: 21.2187, lng: 105.8042, tz: 'Asia/Ho_Chi_Minh' },
    DAD: { name: '岘港国际机场', code: 'DAD', lat: 16.0439, lng: 108.1994, tz: 'Asia/Ho_Chi_Minh' },
    CXR: { name: '芽庄 金兰国际机场', code: 'CXR', lat: 11.9982, lng: 109.2194, tz: 'Asia/Ho_Chi_Minh' },
    SGN: { name: '胡志明市 新山一国际机场', code: 'SGN', lat: 10.8188, lng: 106.6519, tz: 'Asia/Ho_Chi_Minh' },
  }
  const T = (type, number, from, to, dep, arr, fromCityId, toCityId, extra = {}) => ({ id: uid(), type, number, from, to, dep, arr, fromCityId, toCityId, intl: false, ...extra })
  return {
    id: uid(),
    name: '越南南北纵贯 🇻🇳',
    startDate: d(0),
    endDate: d(12),
    cover: 0,
    createdAt: Date.now(),
    sample: true,
    cities: [hanoi, danang, nhatrang, hcmc],
    transports: [
      T('flight', 'VN523', ap.PVG, ap.HAN, `${d(0)}T09:30`, `${d(0)}T11:45`, null, hanoi.id, { intl: true, terminal: 'T1', baggage: '23kg 托运' }),
      T('flight', 'VJ515', ap.HAN, ap.DAD, `${d(3)}T14:05`, `${d(3)}T15:25`, hanoi.id, danang.id, { baggage: '7kg 手提' }),
      T('flight', 'VN1946', ap.DAD, ap.CXR, `${d(6)}T12:40`, `${d(6)}T13:50`, danang.id, nhatrang.id),
      T('train', 'SE4', { name: '芽庄火车站', lat: 12.249, lng: 109.182, tz: 'Asia/Ho_Chi_Minh' }, { name: '西贡火车站', lat: 10.7823, lng: 106.6772, tz: 'Asia/Ho_Chi_Minh' }, `${d(9)}T07:30`, `${d(9)}T15:45`, nhatrang.id, hcmc.id, { bookingRef: '软卧 4 号车厢' }),
      T('flight', 'MU282', ap.SGN, ap.PVG, `${d(12)}T13:30`, `${d(12)}T18:40`, hcmc.id, null, { intl: true }),
    ],
    packing: [],
    expenses: [],
    docs: { passportExpiry: '', visa: '越南电子签（E-visa）', emergency: '中国驻越南大使馆领事保护：+84-24-38453736', notes: '' },
  }
}
