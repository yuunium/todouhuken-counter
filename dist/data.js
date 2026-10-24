export const REGIONS = [
  { id: 'hokkaido', name: '北海道', en: 'HOKKAIDO', ids: [1] },
  { id: 'tohoku', name: '東北', en: 'TOHOKU', ids: [2, 3, 4, 5, 6, 7] },
  { id: 'kanto', name: '関東', en: 'KANTO', ids: [8, 9, 10, 11, 12, 13, 14] },
  { id: 'chubu', name: '中部', en: 'CHUBU', ids: [15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { id: 'kinki', name: '近畿', en: 'KINKI', ids: [24, 25, 26, 27, 28, 29, 30] },
  { id: 'chugoku', name: '中国', en: 'CHUGOKU', ids: [31, 32, 33, 34, 35] },
  { id: 'shikoku', name: '四国', en: 'SHIKOKU', ids: [36, 37, 38, 39] },
  { id: 'kyushu', name: '九州・沖縄', en: 'KYUSHU & OKINAWA', ids: [40, 41, 42, 43, 44, 45, 46, 47] },
];
const names = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
export const PREFECTURES = names.map((name, index) => ({ id: index + 1, name, region: REGIONS.find(r => r.ids.includes(index + 1)).id }));
export const STORAGE_KEY = 'tabinoato:v1';

export const MAX_COUNT = 999999;
