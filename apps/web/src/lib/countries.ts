/**
 * GC-Stats - countries
 *
 * ISO 3166-1 alpha-3 country codes, source of truth for every
 * `country_code` column (teams/people/organizations, all `char(3)`).
 * "INT" is a synthetic code for international/no-fixed-country entities,
 * mirrors V1 Countries::INTERNATIONAL but sized to fit char(3).
 * "ENG", "SCO", "WAL" and "NIR" are the UK home nations (not ISO alpha-3),
 * 3 letters to fit char(3), flags come from flag-icons' `gb-*` sprites.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { AppLocale } from "@/i18n/routing";

export const INTERNATIONAL_CODE = "INT";

// alpha-2 (a2) is only for the flag-icons CSS class (`fi fi-${a2}`, see
// CountrySelect) — flag-icons keys its sprites by ISO 3166-1 alpha-2, not
// alpha-3, so this is a parallel code carried purely for that lookup, not a
// second identifier for the country (the alpha-3 `code` stays canonical,
// same one used by DB columns and isValidCountryCode/countryName below).
export type Country = { code: string; a2: string } & Record<AppLocale, string>;

const INTERNATIONAL: Country = { code: INTERNATIONAL_CODE, a2: "", en: "International", fr: "International", es: "Internacional", pt: "Internacional", tr: "Uluslararası", ja: "インターナショナル", ko: "국제", de: "International", zh: "国际", it: "Internazionale", pl: "Międzynarodowa", ar: "دولي", th: "นานาชาติ" };

const COUNTRIES: Country[] = [
  { code: "AFG", a2: "af", en: "Afghanistan", fr: "Afghanistan", es: "Afganistán", pt: "Afeganistão", tr: "Afganistan", ja: "アフガニスタン", ko: "아프가니스탄", de: "Afghanistan", zh: "阿富汗", it: "Afghanistan", pl: "Afganistan", ar: "أفغانستان", th: "อัฟกานิสถาน" },
  { code: "ALB", a2: "al", en: "Albania", fr: "Albanie", es: "Albania", pt: "Albânia", tr: "Arnavutluk", ja: "アルバニア", ko: "알바니아", de: "Albanien", zh: "阿尔巴尼亚", it: "Albania", pl: "Albania", ar: "ألبانيا", th: "แอลเบเนีย" },
  { code: "DZA", a2: "dz", en: "Algeria", fr: "Algérie", es: "Argelia", pt: "Argélia", tr: "Cezayir", ja: "アルジェリア", ko: "알제리", de: "Algerien", zh: "阿尔及利亚", it: "Algeria", pl: "Algieria", ar: "الجزائر", th: "แอลจีเรีย" },
  { code: "AND", a2: "ad", en: "Andorra", fr: "Andorre", es: "Andorra", pt: "Andorra", tr: "Andorra", ja: "アンドラ", ko: "안도라", de: "Andorra", zh: "安道尔", it: "Andorra", pl: "Andora", ar: "أندورا", th: "อันดอร์รา" },
  { code: "AGO", a2: "ao", en: "Angola", fr: "Angola", es: "Angola", pt: "Angola", tr: "Angola", ja: "アンゴラ", ko: "앙골라", de: "Angola", zh: "安哥拉", it: "Angola", pl: "Angola", ar: "أنغولا", th: "แองโกลา" },
  { code: "ARG", a2: "ar", en: "Argentina", fr: "Argentine", es: "Argentina", pt: "Argentina", tr: "Arjantin", ja: "アルゼンチン", ko: "아르헨티나", de: "Argentinien", zh: "阿根廷", it: "Argentina", pl: "Argentyna", ar: "الأرجنتين", th: "อาร์เจนตินา" },
  { code: "ARM", a2: "am", en: "Armenia", fr: "Arménie", es: "Armenia", pt: "Armênia", tr: "Ermenistan", ja: "アルメニア", ko: "아르메니아", de: "Armenien", zh: "亚美尼亚", it: "Armenia", pl: "Armenia", ar: "أرمينيا", th: "อาร์เมเนีย" },
  { code: "AUS", a2: "au", en: "Australia", fr: "Australie", es: "Australia", pt: "Austrália", tr: "Avustralya", ja: "オーストラリア", ko: "오스트레일리아", de: "Australien", zh: "澳大利亚", it: "Australia", pl: "Australia", ar: "أستراليا", th: "ออสเตรเลีย" },
  { code: "AUT", a2: "at", en: "Austria", fr: "Autriche", es: "Austria", pt: "Áustria", tr: "Avusturya", ja: "オーストリア", ko: "오스트리아", de: "Österreich", zh: "奥地利", it: "Austria", pl: "Austria", ar: "النمسا", th: "ออสเตรีย" },
  { code: "AZE", a2: "az", en: "Azerbaijan", fr: "Azerbaïdjan", es: "Azerbaiyán", pt: "Azerbaijão", tr: "Azerbaycan", ja: "アゼルバイジャン", ko: "아제르바이잔", de: "Aserbaidschan", zh: "阿塞拜疆", it: "Azerbaigian", pl: "Azerbejdżan", ar: "أذربيجان", th: "อาเซอร์ไบจาน" },
  { code: "BHS", a2: "bs", en: "Bahamas", fr: "Bahamas", es: "Bahamas", pt: "Bahamas", tr: "Bahamalar", ja: "バハマ", ko: "바하마", de: "Bahamas", zh: "巴哈马", it: "Bahamas", pl: "Bahamy", ar: "جزر البهاما", th: "บาฮามาส" },
  { code: "BHR", a2: "bh", en: "Bahrain", fr: "Bahreïn", es: "Baréin", pt: "Barein", tr: "Bahreyn", ja: "バーレーン", ko: "바레인", de: "Bahrain", zh: "巴林", it: "Bahrein", pl: "Bahrajn", ar: "البحرين", th: "บาห์เรน" },
  { code: "BGD", a2: "bd", en: "Bangladesh", fr: "Bangladesh", es: "Bangladés", pt: "Bangladesh", tr: "Bangladeş", ja: "バングラデシュ", ko: "방글라데시", de: "Bangladesch", zh: "孟加拉国", it: "Bangladesh", pl: "Bangladesz", ar: "بنغلاديش", th: "บังกลาเทศ" },
  { code: "BRB", a2: "bb", en: "Barbados", fr: "Barbade", es: "Barbados", pt: "Barbados", tr: "Barbados", ja: "バルバドス", ko: "바베이도스", de: "Barbados", zh: "巴巴多斯", it: "Barbados", pl: "Barbados", ar: "بربادوس", th: "บาร์เบโดส" },
  { code: "BLR", a2: "by", en: "Belarus", fr: "Biélorussie", es: "Bielorrusia", pt: "Bielorrússia", tr: "Belarus", ja: "ベラルーシ", ko: "벨라루스", de: "Belarus", zh: "白俄罗斯", it: "Bielorussia", pl: "Białoruś", ar: "بيلاروس", th: "เบลารุส" },
  { code: "BEL", a2: "be", en: "Belgium", fr: "Belgique", es: "Bélgica", pt: "Bélgica", tr: "Belçika", ja: "ベルギー", ko: "벨기에", de: "Belgien", zh: "比利时", it: "Belgio", pl: "Belgia", ar: "بلجيكا", th: "เบลเยียม" },
  { code: "BLZ", a2: "bz", en: "Belize", fr: "Belize", es: "Belice", pt: "Belize", tr: "Belize", ja: "ベリーズ", ko: "벨리즈", de: "Belize", zh: "伯利兹", it: "Belize", pl: "Belize", ar: "بليز", th: "เบลีซ" },
  { code: "BEN", a2: "bj", en: "Benin", fr: "Bénin", es: "Benín", pt: "Benin", tr: "Benin", ja: "ベナン", ko: "베냉", de: "Benin", zh: "贝宁", it: "Benin", pl: "Benin", ar: "بنين", th: "เบนิน" },
  { code: "BTN", a2: "bt", en: "Bhutan", fr: "Bhoutan", es: "Bután", pt: "Butão", tr: "Butan", ja: "ブータン", ko: "부탄", de: "Bhutan", zh: "不丹", it: "Bhutan", pl: "Bhutan", ar: "بوتان", th: "ภูฏาน" },
  { code: "BOL", a2: "bo", en: "Bolivia", fr: "Bolivie", es: "Bolivia", pt: "Bolívia", tr: "Bolivya", ja: "ボリビア", ko: "볼리비아", de: "Bolivien", zh: "玻利维亚", it: "Bolivia", pl: "Boliwia", ar: "بوليفيا", th: "โบลิเวีย" },
  { code: "BIH", a2: "ba", en: "Bosnia and Herzegovina", fr: "Bosnie-Herzégovine", es: "Bosnia y Herzegovina", pt: "Bósnia e Herzegovina", tr: "Bosna-Hersek", ja: "ボスニア・ヘルツェゴビナ", ko: "보스니아 헤르체고비나", de: "Bosnien und Herzegowina", zh: "波斯尼亚和黑塞哥维那", it: "Bosnia ed Erzegovina", pl: "Bośnia i Hercegowina", ar: "البوسنة والهرسك", th: "บอสเนียและเฮอร์เซโกวีนา" },
  { code: "BWA", a2: "bw", en: "Botswana", fr: "Botswana", es: "Botsuana", pt: "Botsuana", tr: "Botsvana", ja: "ボツワナ", ko: "보츠와나", de: "Botsuana", zh: "博茨瓦纳", it: "Botswana", pl: "Botswana", ar: "بوتسوانا", th: "บอตสวานา" },
  { code: "BRA", a2: "br", en: "Brazil", fr: "Brésil", es: "Brasil", pt: "Brasil", tr: "Brezilya", ja: "ブラジル", ko: "브라질", de: "Brasilien", zh: "巴西", it: "Brasile", pl: "Brazylia", ar: "البرازيل", th: "บราซิล" },
  { code: "BRN", a2: "bn", en: "Brunei", fr: "Brunei", es: "Brunéi", pt: "Brunei", tr: "Brunei", ja: "ブルネイ", ko: "브루나이", de: "Brunei Darussalam", zh: "文莱", it: "Brunei", pl: "Brunei", ar: "بروناي", th: "บรูไน" },
  { code: "BGR", a2: "bg", en: "Bulgaria", fr: "Bulgarie", es: "Bulgaria", pt: "Bulgária", tr: "Bulgaristan", ja: "ブルガリア", ko: "불가리아", de: "Bulgarien", zh: "保加利亚", it: "Bulgaria", pl: "Bułgaria", ar: "بلغاريا", th: "บัลแกเรีย" },
  { code: "BFA", a2: "bf", en: "Burkina Faso", fr: "Burkina Faso", es: "Burkina Faso", pt: "Burquina Faso", tr: "Burkina Faso", ja: "ブルキナファソ", ko: "부르키나파소", de: "Burkina Faso", zh: "布基纳法索", it: "Burkina Faso", pl: "Burkina Faso", ar: "بوركينا فاسو", th: "บูร์กินาฟาโซ" },
  { code: "BDI", a2: "bi", en: "Burundi", fr: "Burundi", es: "Burundi", pt: "Burundi", tr: "Burundi", ja: "ブルンジ", ko: "부룬디", de: "Burundi", zh: "布隆迪", it: "Burundi", pl: "Burundi", ar: "بوروندي", th: "บุรุนดี" },
  { code: "KHM", a2: "kh", en: "Cambodia", fr: "Cambodge", es: "Camboya", pt: "Camboja", tr: "Kamboçya", ja: "カンボジア", ko: "캄보디아", de: "Kambodscha", zh: "柬埔寨", it: "Cambogia", pl: "Kambodża", ar: "كمبوديا", th: "กัมพูชา" },
  { code: "CMR", a2: "cm", en: "Cameroon", fr: "Cameroun", es: "Camerún", pt: "Camarões", tr: "Kamerun", ja: "カメルーン", ko: "카메룬", de: "Kamerun", zh: "喀麦隆", it: "Camerun", pl: "Kamerun", ar: "الكاميرون", th: "แคเมอรูน" },
  { code: "CAN", a2: "ca", en: "Canada", fr: "Canada", es: "Canadá", pt: "Canadá", tr: "Kanada", ja: "カナダ", ko: "캐나다", de: "Kanada", zh: "加拿大", it: "Canada", pl: "Kanada", ar: "كندا", th: "แคนาดา" },
  { code: "CPV", a2: "cv", en: "Cabo Verde", fr: "Cap-Vert", es: "Cabo Verde", pt: "Cabo Verde", tr: "Cabo Verde", ja: "カーボベルデ", ko: "카보베르데", de: "Cabo Verde", zh: "佛得角", it: "Capo Verde", pl: "Republika Zielonego Przylądka", ar: "الرأس الأخضر", th: "เคปเวิร์ด" },
  { code: "CAF", a2: "cf", en: "Central African Republic", fr: "République centrafricaine", es: "República Centroafricana", pt: "República Centro-Africana", tr: "Orta Afrika Cumhuriyeti", ja: "中央アフリカ共和国", ko: "중앙 아프리카 공화국", de: "Zentralafrikanische Republik", zh: "中非共和国", it: "Repubblica Centrafricana", pl: "Republika Środkowoafrykańska", ar: "جمهورية أفريقيا الوسطى", th: "สาธารณรัฐแอฟริกากลาง" },
  { code: "TCD", a2: "td", en: "Chad", fr: "Tchad", es: "Chad", pt: "Chade", tr: "Çad", ja: "チャド", ko: "차드", de: "Tschad", zh: "乍得", it: "Ciad", pl: "Czad", ar: "تشاد", th: "ชาด" },
  { code: "CHL", a2: "cl", en: "Chile", fr: "Chili", es: "Chile", pt: "Chile", tr: "Şili", ja: "チリ", ko: "칠레", de: "Chile", zh: "智利", it: "Cile", pl: "Chile", ar: "تشيلي", th: "ชิลี" },
  { code: "CHN", a2: "cn", en: "China", fr: "Chine", es: "China", pt: "China", tr: "Çin", ja: "中国", ko: "중국", de: "China", zh: "中国", it: "Cina", pl: "Chiny", ar: "الصين", th: "จีน" },
  { code: "COL", a2: "co", en: "Colombia", fr: "Colombie", es: "Colombia", pt: "Colômbia", tr: "Kolombiya", ja: "コロンビア", ko: "콜롬비아", de: "Kolumbien", zh: "哥伦比亚", it: "Colombia", pl: "Kolumbia", ar: "كولومبيا", th: "โคลอมเบีย" },
  { code: "COM", a2: "km", en: "Comoros", fr: "Comores", es: "Comoras", pt: "Comores", tr: "Komorlar", ja: "コモロ", ko: "코모로", de: "Komoren", zh: "科摩罗", it: "Comore", pl: "Komory", ar: "جزر القمر", th: "คอโมโรส" },
  { code: "COG", a2: "cg", en: "Congo", fr: "Congo", es: "Congo", pt: "República do Congo", tr: "Kongo Cumhuriyeti", ja: "コンゴ共和国", ko: "콩고-브라자빌", de: "Kongo-Brazzaville", zh: "刚果（布）", it: "Congo", pl: "Kongo", ar: "الكونغو", th: "คองโก" },
  { code: "COD", a2: "cd", en: "DR Congo", fr: "RD Congo", es: "República Democrática del Congo", pt: "Congo - Kinshasa", tr: "Kongo Demokratik Cumhuriyeti", ja: "コンゴ民主共和国", ko: "콩고-킨샤사", de: "Kongo-Kinshasa", zh: "刚果（金）", it: "RD del Congo", pl: "DR Konga", ar: "الكونغو الديمقراطية", th: "คองโก (DR)" },
  { code: "CRI", a2: "cr", en: "Costa Rica", fr: "Costa Rica", es: "Costa Rica", pt: "Costa Rica", tr: "Kosta Rika", ja: "コスタリカ", ko: "코스타리카", de: "Costa Rica", zh: "哥斯达黎加", it: "Costa Rica", pl: "Kostaryka", ar: "كوستاريكا", th: "คอสตาริกา" },
  { code: "CIV", a2: "ci", en: "Côte d'Ivoire", fr: "Côte d'Ivoire", es: "Costa de Marfil", pt: "Costa do Marfim", tr: "Fildişi Sahili", ja: "コートジボワール", ko: "코트디부아르", de: "Côte d’Ivoire", zh: "科特迪瓦", it: "Costa d’Avorio", pl: "Côte d’Ivoire", ar: "ساحل العاج", th: "โกตดิวัวร์" },
  { code: "HRV", a2: "hr", en: "Croatia", fr: "Croatie", es: "Croacia", pt: "Croácia", tr: "Hırvatistan", ja: "クロアチア", ko: "크로아티아", de: "Kroatien", zh: "克罗地亚", it: "Croazia", pl: "Chorwacja", ar: "كرواتيا", th: "โครเอเชีย" },
  { code: "CUB", a2: "cu", en: "Cuba", fr: "Cuba", es: "Cuba", pt: "Cuba", tr: "Küba", ja: "キューバ", ko: "쿠바", de: "Kuba", zh: "古巴", it: "Cuba", pl: "Kuba", ar: "كوبا", th: "คิวบา" },
  { code: "CYP", a2: "cy", en: "Cyprus", fr: "Chypre", es: "Chipre", pt: "Chipre", tr: "Kıbrıs", ja: "キプロス", ko: "키프로스", de: "Zypern", zh: "塞浦路斯", it: "Cipro", pl: "Cypr", ar: "قبرص", th: "ไซปรัส" },
  { code: "CZE", a2: "cz", en: "Czechia", fr: "Tchéquie", es: "Chequia", pt: "Tchéquia", tr: "Çekya", ja: "チェコ", ko: "체코", de: "Tschechien", zh: "捷克", it: "Cechia", pl: "Czechy", ar: "التشيك", th: "เช็ก" },
  { code: "DNK", a2: "dk", en: "Denmark", fr: "Danemark", es: "Dinamarca", pt: "Dinamarca", tr: "Danimarka", ja: "デンマーク", ko: "덴마크", de: "Dänemark", zh: "丹麦", it: "Danimarca", pl: "Dania", ar: "الدانمرك", th: "เดนมาร์ก" },
  { code: "DJI", a2: "dj", en: "Djibouti", fr: "Djibouti", es: "Yibuti", pt: "Djibuti", tr: "Cibuti", ja: "ジブチ", ko: "지부티", de: "Dschibuti", zh: "吉布提", it: "Gibuti", pl: "Dżibuti", ar: "جيبوتي", th: "จิบูตี" },
  { code: "DMA", a2: "dm", en: "Dominica", fr: "Dominique", es: "Dominica", pt: "Dominica", tr: "Dominika", ja: "ドミニカ国", ko: "도미니카", de: "Dominica", zh: "多米尼克", it: "Dominica", pl: "Dominika", ar: "دومينيكا", th: "โดมินิกา" },
  { code: "DOM", a2: "do", en: "Dominican Republic", fr: "République dominicaine", es: "República Dominicana", pt: "República Dominicana", tr: "Dominik Cumhuriyeti", ja: "ドミニカ共和国", ko: "도미니카 공화국", de: "Dominikanische Republik", zh: "多米尼加共和国", it: "Repubblica Dominicana", pl: "Dominikana", ar: "جمهورية الدومينيكان", th: "สาธารณรัฐโดมินิกัน" },
  { code: "ECU", a2: "ec", en: "Ecuador", fr: "Équateur", es: "Ecuador", pt: "Equador", tr: "Ekvador", ja: "エクアドル", ko: "에콰도르", de: "Ecuador", zh: "厄瓜多尔", it: "Ecuador", pl: "Ekwador", ar: "الإكوادور", th: "เอกวาดอร์" },
  { code: "EGY", a2: "eg", en: "Egypt", fr: "Égypte", es: "Egipto", pt: "Egito", tr: "Mısır", ja: "エジプト", ko: "이집트", de: "Ägypten", zh: "埃及", it: "Egitto", pl: "Egipt", ar: "مصر", th: "อียิปต์" },
  { code: "SLV", a2: "sv", en: "El Salvador", fr: "Salvador", es: "El Salvador", pt: "El Salvador", tr: "El Salvador", ja: "エルサルバドル", ko: "엘살바도르", de: "El Salvador", zh: "萨尔瓦多", it: "El Salvador", pl: "Salwador", ar: "السلفادور", th: "เอลซัลวาดอร์" },
  { code: "GNQ", a2: "gq", en: "Equatorial Guinea", fr: "Guinée équatoriale", es: "Guinea Ecuatorial", pt: "Guiné Equatorial", tr: "Ekvator Ginesi", ja: "赤道ギニア", ko: "적도 기니", de: "Äquatorialguinea", zh: "赤道几内亚", it: "Guinea Equatoriale", pl: "Gwinea Równikowa", ar: "غينيا الاستوائية", th: "อิเควทอเรียลกินี" },
  { code: "ERI", a2: "er", en: "Eritrea", fr: "Érythrée", es: "Eritrea", pt: "Eritreia", tr: "Eritre", ja: "エリトリア", ko: "에리트리아", de: "Eritrea", zh: "厄立特里亚", it: "Eritrea", pl: "Erytrea", ar: "إريتريا", th: "เอริเทรีย" },
  { code: "EST", a2: "ee", en: "Estonia", fr: "Estonie", es: "Estonia", pt: "Estônia", tr: "Estonya", ja: "エストニア", ko: "에스토니아", de: "Estland", zh: "爱沙尼亚", it: "Estonia", pl: "Estonia", ar: "إستونيا", th: "เอสโตเนีย" },
  { code: "SWZ", a2: "sz", en: "Eswatini", fr: "Eswatini", es: "Esuatini", pt: "Essuatíni", tr: "Esvatini", ja: "エスワティニ", ko: "에스와티니", de: "Eswatini", zh: "斯威士兰", it: "Eswatini", pl: "Eswatini", ar: "إسواتيني", th: "เอสวาตีนี" },
  { code: "ETH", a2: "et", en: "Ethiopia", fr: "Éthiopie", es: "Etiopía", pt: "Etiópia", tr: "Etiyopya", ja: "エチオピア", ko: "에티오피아", de: "Äthiopien", zh: "埃塞俄比亚", it: "Etiopia", pl: "Etiopia", ar: "إثيوبيا", th: "เอธิโอเปีย" },
  // Synthetic entry (like INTERNATIONAL_CODE below) — not a real ISO 3166-1
  // country, but flag-icons ships a European Union flag under "eu", used
  // here for orgs/teams/people representing Europe broadly rather than one
  // nation. "EUR" doesn't collide with any real alpha-3 code.
  { code: "EUR", a2: "eu", en: "Europe", fr: "Europe", es: "Unión Europea", pt: "União Europeia", tr: "Avrupa Birliği", ja: "欧州連合", ko: "유럽 연합", de: "Europäische Union", zh: "欧盟", it: "Europa", pl: "Europa", ar: "أوروبا", th: "ยุโรป" },
  { code: "FJI", a2: "fj", en: "Fiji", fr: "Fidji", es: "Fiyi", pt: "Fiji", tr: "Fiji", ja: "フィジー", ko: "피지", de: "Fidschi", zh: "斐济", it: "Figi", pl: "Fidżi", ar: "فيجي", th: "ฟิจิ" },
  { code: "FIN", a2: "fi", en: "Finland", fr: "Finlande", es: "Finlandia", pt: "Finlândia", tr: "Finlandiya", ja: "フィンランド", ko: "핀란드", de: "Finnland", zh: "芬兰", it: "Finlandia", pl: "Finlandia", ar: "فنلندا", th: "ฟินแลนด์" },
  { code: "FRA", a2: "fr", en: "France", fr: "France", es: "Francia", pt: "França", tr: "Fransa", ja: "フランス", ko: "프랑스", de: "Frankreich", zh: "法国", it: "Francia", pl: "Francja", ar: "فرنسا", th: "ฝรั่งเศส" },
  { code: "GAB", a2: "ga", en: "Gabon", fr: "Gabon", es: "Gabón", pt: "Gabão", tr: "Gabon", ja: "ガボン", ko: "가봉", de: "Gabun", zh: "加蓬", it: "Gabon", pl: "Gabon", ar: "الغابون", th: "กาบอง" },
  { code: "GMB", a2: "gm", en: "Gambia", fr: "Gambie", es: "Gambia", pt: "Gâmbia", tr: "Gambiya", ja: "ガンビア", ko: "감비아", de: "Gambia", zh: "冈比亚", it: "Gambia", pl: "Gambia", ar: "غامبيا", th: "แกมเบีย" },
  { code: "GEO", a2: "ge", en: "Georgia", fr: "Géorgie", es: "Georgia", pt: "Geórgia", tr: "Gürcistan", ja: "ジョージア", ko: "조지아", de: "Georgien", zh: "格鲁吉亚", it: "Georgia", pl: "Gruzja", ar: "جورجيا", th: "จอร์เจีย" },
  { code: "DEU", a2: "de", en: "Germany", fr: "Allemagne", es: "Alemania", pt: "Alemanha", tr: "Almanya", ja: "ドイツ", ko: "독일", de: "Deutschland", zh: "德国", it: "Germania", pl: "Niemcy", ar: "ألمانيا", th: "เยอรมนี" },
  { code: "GHA", a2: "gh", en: "Ghana", fr: "Ghana", es: "Ghana", pt: "Gana", tr: "Gana", ja: "ガーナ", ko: "가나", de: "Ghana", zh: "加纳", it: "Ghana", pl: "Ghana", ar: "غانا", th: "กานา" },
  { code: "GRC", a2: "gr", en: "Greece", fr: "Grèce", es: "Grecia", pt: "Grécia", tr: "Yunanistan", ja: "ギリシャ", ko: "그리스", de: "Griechenland", zh: "希腊", it: "Grecia", pl: "Grecja", ar: "اليونان", th: "กรีซ" },
  { code: "GRD", a2: "gd", en: "Grenada", fr: "Grenade", es: "Granada", pt: "Granada", tr: "Grenada", ja: "グレナダ", ko: "그레나다", de: "Grenada", zh: "格林纳达", it: "Grenada", pl: "Grenada", ar: "غرينادا", th: "เกรเนดา" },
  { code: "GTM", a2: "gt", en: "Guatemala", fr: "Guatemala", es: "Guatemala", pt: "Guatemala", tr: "Guatemala", ja: "グアテマラ", ko: "과테말라", de: "Guatemala", zh: "危地马拉", it: "Guatemala", pl: "Gwatemala", ar: "غواتيمالا", th: "กัวเตมาลา" },
  { code: "GIN", a2: "gn", en: "Guinea", fr: "Guinée", es: "Guinea", pt: "Guiné", tr: "Gine", ja: "ギニア", ko: "기니", de: "Guinea", zh: "几内亚", it: "Guinea", pl: "Gwinea", ar: "غينيا", th: "กินี" },
  { code: "GNB", a2: "gw", en: "Guinea-Bissau", fr: "Guinée-Bissau", es: "Guinea-Bisáu", pt: "Guiné-Bissau", tr: "Gine-Bissau", ja: "ギニアビサウ", ko: "기니비사우", de: "Guinea-Bissau", zh: "几内亚比绍", it: "Guinea-Bissau", pl: "Gwinea Bissau", ar: "غينيا بيساو", th: "กินี-บิสเซา" },
  { code: "GUY", a2: "gy", en: "Guyana", fr: "Guyana", es: "Guyana", pt: "Guiana", tr: "Guyana", ja: "ガイアナ", ko: "가이아나", de: "Guyana", zh: "圭亚那", it: "Guyana", pl: "Gujana", ar: "غيانا", th: "กายอานา" },
  { code: "HTI", a2: "ht", en: "Haiti", fr: "Haïti", es: "Haití", pt: "Haiti", tr: "Haiti", ja: "ハイチ", ko: "아이티", de: "Haiti", zh: "海地", it: "Haiti", pl: "Haiti", ar: "هايتي", th: "เฮติ" },
  { code: "HND", a2: "hn", en: "Honduras", fr: "Honduras", es: "Honduras", pt: "Honduras", tr: "Honduras", ja: "ホンジュラス", ko: "온두라스", de: "Honduras", zh: "洪都拉斯", it: "Honduras", pl: "Honduras", ar: "هندوراس", th: "ฮอนดูรัส" },
  { code: "HKG", a2: "hk", en: "Hong Kong", fr: "Hong Kong", es: "Hong Kong", pt: "Hong Kong", tr: "Hong Kong", ja: "香港", ko: "홍콩", de: "Hongkong", zh: "中国香港", it: "Hong Kong", pl: "Hongkong", ar: "هونغ كونغ", th: "ฮ่องกง" },
  { code: "HUN", a2: "hu", en: "Hungary", fr: "Hongrie", es: "Hungría", pt: "Hungria", tr: "Macaristan", ja: "ハンガリー", ko: "헝가리", de: "Ungarn", zh: "匈牙利", it: "Ungheria", pl: "Węgry", ar: "هنغاريا", th: "ฮังการี" },
  { code: "ISL", a2: "is", en: "Iceland", fr: "Islande", es: "Islandia", pt: "Islândia", tr: "İzlanda", ja: "アイスランド", ko: "아이슬란드", de: "Island", zh: "冰岛", it: "Islanda", pl: "Islandia", ar: "آيسلندا", th: "ไอซ์แลนด์" },
  { code: "IND", a2: "in", en: "India", fr: "Inde", es: "India", pt: "Índia", tr: "Hindistan", ja: "インド", ko: "인도", de: "Indien", zh: "印度", it: "India", pl: "Indie", ar: "الهند", th: "อินเดีย" },
  { code: "IDN", a2: "id", en: "Indonesia", fr: "Indonésie", es: "Indonesia", pt: "Indonésia", tr: "Endonezya", ja: "インドネシア", ko: "인도네시아", de: "Indonesien", zh: "印度尼西亚", it: "Indonesia", pl: "Indonezja", ar: "إندونيسيا", th: "อินโดนีเซีย" },
  { code: "IRN", a2: "ir", en: "Iran", fr: "Iran", es: "Irán", pt: "Irã", tr: "İran", ja: "イラン", ko: "이란", de: "Iran", zh: "伊朗", it: "Iran", pl: "Iran", ar: "إيران", th: "อิหร่าน" },
  { code: "IRQ", a2: "iq", en: "Iraq", fr: "Irak", es: "Irak", pt: "Iraque", tr: "Irak", ja: "イラク", ko: "이라크", de: "Irak", zh: "伊拉克", it: "Iraq", pl: "Irak", ar: "العراق", th: "อิรัก" },
  { code: "IRL", a2: "ie", en: "Ireland", fr: "Irlande", es: "Irlanda", pt: "Irlanda", tr: "İrlanda", ja: "アイルランド", ko: "아일랜드", de: "Irland", zh: "爱尔兰", it: "Irlanda", pl: "Irlandia", ar: "أيرلندا", th: "ไอร์แลนด์" },
  { code: "ISR", a2: "il", en: "Israel", fr: "Israël", es: "Israel", pt: "Israel", tr: "İsrail", ja: "イスラエル", ko: "이스라엘", de: "Israel", zh: "以色列", it: "Israele", pl: "Izrael", ar: "إسرائيل", th: "อิสราเอล" },
  { code: "ITA", a2: "it", en: "Italy", fr: "Italie", es: "Italia", pt: "Itália", tr: "İtalya", ja: "イタリア", ko: "이탈리아", de: "Italien", zh: "意大利", it: "Italia", pl: "Włochy", ar: "إيطاليا", th: "อิตาลี" },
  { code: "JAM", a2: "jm", en: "Jamaica", fr: "Jamaïque", es: "Jamaica", pt: "Jamaica", tr: "Jamaika", ja: "ジャマイカ", ko: "자메이카", de: "Jamaika", zh: "牙买加", it: "Giamaica", pl: "Jamajka", ar: "جامايكا", th: "จาเมกา" },
  { code: "JPN", a2: "jp", en: "Japan", fr: "Japon", es: "Japón", pt: "Japão", tr: "Japonya", ja: "日本", ko: "일본", de: "Japan", zh: "日本", it: "Giappone", pl: "Japonia", ar: "اليابان", th: "ญี่ปุ่น" },
  { code: "JOR", a2: "jo", en: "Jordan", fr: "Jordanie", es: "Jordania", pt: "Jordânia", tr: "Ürdün", ja: "ヨルダン", ko: "요르단", de: "Jordanien", zh: "约旦", it: "Giordania", pl: "Jordania", ar: "الأردن", th: "จอร์แดน" },
  { code: "KAZ", a2: "kz", en: "Kazakhstan", fr: "Kazakhstan", es: "Kazajistán", pt: "Cazaquistão", tr: "Kazakistan", ja: "カザフスタン", ko: "카자흐스탄", de: "Kasachstan", zh: "哈萨克斯坦", it: "Kazakistan", pl: "Kazachstan", ar: "كازاخستان", th: "คาซัคสถาน" },
  { code: "KEN", a2: "ke", en: "Kenya", fr: "Kenya", es: "Kenia", pt: "Quênia", tr: "Kenya", ja: "ケニア", ko: "케냐", de: "Kenia", zh: "肯尼亚", it: "Kenya", pl: "Kenia", ar: "كينيا", th: "เคนยา" },
  { code: "KIR", a2: "ki", en: "Kiribati", fr: "Kiribati", es: "Kiribati", pt: "Quiribati", tr: "Kiribati", ja: "キリバス", ko: "키리바시", de: "Kiribati", zh: "基里巴斯", it: "Kiribati", pl: "Kiribati", ar: "كيريباتي", th: "คิริบาส" },
  { code: "KWT", a2: "kw", en: "Kuwait", fr: "Koweït", es: "Kuwait", pt: "Kuwait", tr: "Kuveyt", ja: "クウェート", ko: "쿠웨이트", de: "Kuwait", zh: "科威特", it: "Kuwait", pl: "Kuwejt", ar: "الكويت", th: "คูเวต" },
  { code: "KGZ", a2: "kg", en: "Kyrgyzstan", fr: "Kirghizistan", es: "Kirguistán", pt: "Quirguistão", tr: "Kırgızistan", ja: "キルギス", ko: "키르기스스탄", de: "Kirgisistan", zh: "吉尔吉斯斯坦", it: "Kirghizistan", pl: "Kirgistan", ar: "قيرغيزستان", th: "คีร์กีซสถาน" },
  { code: "LAO", a2: "la", en: "Laos", fr: "Laos", es: "Laos", pt: "Laos", tr: "Laos", ja: "ラオス", ko: "라오스", de: "Laos", zh: "老挝", it: "Laos", pl: "Laos", ar: "لاوس", th: "ลาว" },
  { code: "LVA", a2: "lv", en: "Latvia", fr: "Lettonie", es: "Letonia", pt: "Letônia", tr: "Letonya", ja: "ラトビア", ko: "라트비아", de: "Lettland", zh: "拉脱维亚", it: "Lettonia", pl: "Łotwa", ar: "لاتفيا", th: "ลัตเวีย" },
  { code: "LBN", a2: "lb", en: "Lebanon", fr: "Liban", es: "Líbano", pt: "Líbano", tr: "Lübnan", ja: "レバノン", ko: "레바논", de: "Libanon", zh: "黎巴嫩", it: "Libano", pl: "Liban", ar: "لبنان", th: "เลบานอน" },
  { code: "LSO", a2: "ls", en: "Lesotho", fr: "Lesotho", es: "Lesoto", pt: "Lesoto", tr: "Lesotho", ja: "レソト", ko: "레소토", de: "Lesotho", zh: "莱索托", it: "Lesotho", pl: "Lesotho", ar: "ليسوتو", th: "เลโซโท" },
  { code: "LBR", a2: "lr", en: "Liberia", fr: "Libéria", es: "Liberia", pt: "Libéria", tr: "Liberya", ja: "リベリア", ko: "라이베리아", de: "Liberia", zh: "利比里亚", it: "Liberia", pl: "Liberia", ar: "ليبيريا", th: "ไลบีเรีย" },
  { code: "LBY", a2: "ly", en: "Libya", fr: "Libye", es: "Libia", pt: "Líbia", tr: "Libya", ja: "リビア", ko: "리비아", de: "Libyen", zh: "利比亚", it: "Libia", pl: "Libia", ar: "ليبيا", th: "ลิเบีย" },
  { code: "LIE", a2: "li", en: "Liechtenstein", fr: "Liechtenstein", es: "Liechtenstein", pt: "Liechtenstein", tr: "Liechtenstein", ja: "リヒテンシュタイン", ko: "리히텐슈타인", de: "Liechtenstein", zh: "列支敦士登", it: "Liechtenstein", pl: "Liechtenstein", ar: "ليختنشتاين", th: "ลิกเตนสไตน์" },
  { code: "LTU", a2: "lt", en: "Lithuania", fr: "Lituanie", es: "Lituania", pt: "Lituânia", tr: "Litvanya", ja: "リトアニア", ko: "리투아니아", de: "Litauen", zh: "立陶宛", it: "Lituania", pl: "Litwa", ar: "ليتوانيا", th: "ลิทัวเนีย" },
  { code: "LUX", a2: "lu", en: "Luxembourg", fr: "Luxembourg", es: "Luxemburgo", pt: "Luxemburgo", tr: "Lüksemburg", ja: "ルクセンブルク", ko: "룩셈부르크", de: "Luxemburg", zh: "卢森堡", it: "Lussemburgo", pl: "Luksemburg", ar: "لوكسمبورغ", th: "ลักเซมเบิร์ก" },
  { code: "MAC", a2: "mo", en: "Macao", fr: "Macao", es: "Macao", pt: "Macau", tr: "Makao", ja: "マカオ", ko: "마카오", de: "Macau", zh: "中国澳门", it: "Macao", pl: "Makau", ar: "ماكاو", th: "มาเก๊า" },
  { code: "MDG", a2: "mg", en: "Madagascar", fr: "Madagascar", es: "Madagascar", pt: "Madagascar", tr: "Madagaskar", ja: "マダガスカル", ko: "마다가스카르", de: "Madagaskar", zh: "马达加斯加", it: "Madagascar", pl: "Madagaskar", ar: "مدغشقر", th: "มาดากัสการ์" },
  { code: "MWI", a2: "mw", en: "Malawi", fr: "Malawi", es: "Malaui", pt: "Malaui", tr: "Malavi", ja: "マラウイ", ko: "말라위", de: "Malawi", zh: "马拉维", it: "Malawi", pl: "Malawi", ar: "ملاوي", th: "มาลาวี" },
  { code: "MYS", a2: "my", en: "Malaysia", fr: "Malaisie", es: "Malasia", pt: "Malásia", tr: "Malezya", ja: "マレーシア", ko: "말레이시아", de: "Malaysia", zh: "马来西亚", it: "Malaysia", pl: "Malezja", ar: "ماليزيا", th: "มาเลเซีย" },
  { code: "MDV", a2: "mv", en: "Maldives", fr: "Maldives", es: "Maldivas", pt: "Maldivas", tr: "Maldivler", ja: "モルディブ", ko: "몰디브", de: "Malediven", zh: "马尔代夫", it: "Maldive", pl: "Malediwy", ar: "جزر المالديف", th: "มัลดีฟส์" },
  { code: "MLI", a2: "ml", en: "Mali", fr: "Mali", es: "Mali", pt: "Mali", tr: "Mali", ja: "マリ", ko: "말리", de: "Mali", zh: "马里", it: "Mali", pl: "Mali", ar: "مالي", th: "มาลี" },
  { code: "MLT", a2: "mt", en: "Malta", fr: "Malte", es: "Malta", pt: "Malta", tr: "Malta", ja: "マルタ", ko: "몰타", de: "Malta", zh: "马耳他", it: "Malta", pl: "Malta", ar: "مالطا", th: "มอลตา" },
  { code: "MHL", a2: "mh", en: "Marshall Islands", fr: "Îles Marshall", es: "Islas Marshall", pt: "Ilhas Marshall", tr: "Marshall Adaları", ja: "マーシャル諸島", ko: "마셜 제도", de: "Marshallinseln", zh: "马绍尔群岛", it: "Isole Marshall", pl: "Wyspy Marshalla", ar: "جزر مارشال", th: "หมู่เกาะมาร์แชลล์" },
  { code: "MRT", a2: "mr", en: "Mauritania", fr: "Mauritanie", es: "Mauritania", pt: "Mauritânia", tr: "Moritanya", ja: "モーリタニア", ko: "모리타니", de: "Mauretanien", zh: "毛里塔尼亚", it: "Mauritania", pl: "Mauretania", ar: "موريتانيا", th: "มอริเตเนีย" },
  { code: "MUS", a2: "mu", en: "Mauritius", fr: "Maurice", es: "Mauricio", pt: "Maurício", tr: "Mauritius", ja: "モーリシャス", ko: "모리셔스", de: "Mauritius", zh: "毛里求斯", it: "Mauritius", pl: "Mauritius", ar: "موريشيوس", th: "มอริเชียส" },
  { code: "MEX", a2: "mx", en: "Mexico", fr: "Mexique", es: "México", pt: "México", tr: "Meksika", ja: "メキシコ", ko: "멕시코", de: "Mexiko", zh: "墨西哥", it: "Messico", pl: "Meksyk", ar: "المكسيك", th: "เม็กซิโก" },
  { code: "FSM", a2: "fm", en: "Micronesia", fr: "Micronésie", es: "Micronesia", pt: "Micronésia", tr: "Mikronezya", ja: "ミクロネシア連邦", ko: "미크로네시아", de: "Mikronesien", zh: "密克罗尼西亚", it: "Micronesia", pl: "Mikronezja", ar: "ميكرونيزيا", th: "ไมโครนีเซีย" },
  { code: "MDA", a2: "md", en: "Moldova", fr: "Moldavie", es: "Moldavia", pt: "Moldávia", tr: "Moldova", ja: "モルドバ", ko: "몰도바", de: "Republik Moldau", zh: "摩尔多瓦", it: "Moldavia", pl: "Mołdawia", ar: "مولدوفا", th: "มอลโดวา" },
  { code: "MCO", a2: "mc", en: "Monaco", fr: "Monaco", es: "Mónaco", pt: "Mônaco", tr: "Monako", ja: "モナコ", ko: "모나코", de: "Monaco", zh: "摩纳哥", it: "Monaco", pl: "Monako", ar: "موناكو", th: "โมนาโก" },
  { code: "MNG", a2: "mn", en: "Mongolia", fr: "Mongolie", es: "Mongolia", pt: "Mongólia", tr: "Moğolistan", ja: "モンゴル", ko: "몽골", de: "Mongolei", zh: "蒙古", it: "Mongolia", pl: "Mongolia", ar: "منغوليا", th: "มองโกเลีย" },
  { code: "MNE", a2: "me", en: "Montenegro", fr: "Monténégro", es: "Montenegro", pt: "Montenegro", tr: "Karadağ", ja: "モンテネグロ", ko: "몬테네그로", de: "Montenegro", zh: "黑山", it: "Montenegro", pl: "Czarnogóra", ar: "الجبل الأسود", th: "มอนเตเนโกร" },
  { code: "MAR", a2: "ma", en: "Morocco", fr: "Maroc", es: "Marruecos", pt: "Marrocos", tr: "Fas", ja: "モロッコ", ko: "모로코", de: "Marokko", zh: "摩洛哥", it: "Marocco", pl: "Maroko", ar: "المغرب", th: "โมร็อกโก" },
  { code: "MOZ", a2: "mz", en: "Mozambique", fr: "Mozambique", es: "Mozambique", pt: "Moçambique", tr: "Mozambik", ja: "モザンビーク", ko: "모잠비크", de: "Mosambik", zh: "莫桑比克", it: "Mozambico", pl: "Mozambik", ar: "موزمبيق", th: "โมซัมบิก" },
  { code: "MMR", a2: "mm", en: "Myanmar", fr: "Myanmar", es: "Myanmar", pt: "Mianmar", tr: "Myanmar (Burma)", ja: "ミャンマー", ko: "미얀마", de: "Myanmar", zh: "缅甸", it: "Myanmar (Birmania)", pl: "Mjanma (Birma)", ar: "ميانمار (بورما)", th: "เมียนมา (พม่า)" },
  { code: "NAM", a2: "na", en: "Namibia", fr: "Namibie", es: "Namibia", pt: "Namíbia", tr: "Namibya", ja: "ナミビア", ko: "나미비아", de: "Namibia", zh: "纳米比亚", it: "Namibia", pl: "Namibia", ar: "ناميبيا", th: "นามิเบีย" },
  { code: "NRU", a2: "nr", en: "Nauru", fr: "Nauru", es: "Nauru", pt: "Nauru", tr: "Nauru", ja: "ナウル", ko: "나우루", de: "Nauru", zh: "瑙鲁", it: "Nauru", pl: "Nauru", ar: "ناورو", th: "นาอูรู" },
  { code: "NPL", a2: "np", en: "Nepal", fr: "Népal", es: "Nepal", pt: "Nepal", tr: "Nepal", ja: "ネパール", ko: "네팔", de: "Nepal", zh: "尼泊尔", it: "Nepal", pl: "Nepal", ar: "نيبال", th: "เนปาล" },
  { code: "NLD", a2: "nl", en: "Netherlands", fr: "Pays-Bas", es: "Países Bajos", pt: "Países Baixos", tr: "Hollanda", ja: "オランダ", ko: "네덜란드", de: "Niederlande", zh: "荷兰", it: "Paesi Bassi", pl: "Holandia", ar: "هولندا", th: "เนเธอร์แลนด์" },
  { code: "NZL", a2: "nz", en: "New Zealand", fr: "Nouvelle-Zélande", es: "Nueva Zelanda", pt: "Nova Zelândia", tr: "Yeni Zelanda", ja: "ニュージーランド", ko: "뉴질랜드", de: "Neuseeland", zh: "新西兰", it: "Nuova Zelanda", pl: "Nowa Zelandia", ar: "نيوزيلندا", th: "นิวซีแลนด์" },
  { code: "NIC", a2: "ni", en: "Nicaragua", fr: "Nicaragua", es: "Nicaragua", pt: "Nicarágua", tr: "Nikaragua", ja: "ニカラグア", ko: "니카라과", de: "Nicaragua", zh: "尼加拉瓜", it: "Nicaragua", pl: "Nikaragua", ar: "نيكاراغوا", th: "นิการากัว" },
  { code: "NER", a2: "ne", en: "Niger", fr: "Niger", es: "Níger", pt: "Níger", tr: "Nijer", ja: "ニジェール", ko: "니제르", de: "Niger", zh: "尼日尔", it: "Niger", pl: "Niger", ar: "النيجر", th: "ไนเจอร์" },
  { code: "NGA", a2: "ng", en: "Nigeria", fr: "Nigéria", es: "Nigeria", pt: "Nigéria", tr: "Nijerya", ja: "ナイジェリア", ko: "나이지리아", de: "Nigeria", zh: "尼日利亚", it: "Nigeria", pl: "Nigeria", ar: "نيجيريا", th: "ไนจีเรีย" },
  { code: "PRK", a2: "kp", en: "North Korea", fr: "Corée du Nord", es: "Corea del Norte", pt: "Coreia do Norte", tr: "Kuzey Kore", ja: "北朝鮮", ko: "북한", de: "Nordkorea", zh: "朝鲜", it: "Corea del Nord", pl: "Korea Północna", ar: "كوريا الشمالية", th: "เกาหลีเหนือ" },
  { code: "MKD", a2: "mk", en: "North Macedonia", fr: "Macédoine du Nord", es: "Macedonia del Norte", pt: "Macedônia do Norte", tr: "Kuzey Makedonya", ja: "北マケドニア", ko: "북마케도니아", de: "Nordmazedonien", zh: "北马其顿", it: "Macedonia del Nord", pl: "Macedonia Północna", ar: "مقدونيا الشمالية", th: "มาซิโดเนียเหนือ" },
  { code: "NOR", a2: "no", en: "Norway", fr: "Norvège", es: "Noruega", pt: "Noruega", tr: "Norveç", ja: "ノルウェー", ko: "노르웨이", de: "Norwegen", zh: "挪威", it: "Norvegia", pl: "Norwegia", ar: "النرويج", th: "นอร์เวย์" },
  { code: "OMN", a2: "om", en: "Oman", fr: "Oman", es: "Omán", pt: "Omã", tr: "Umman", ja: "オマーン", ko: "오만", de: "Oman", zh: "阿曼", it: "Oman", pl: "Oman", ar: "عُمان", th: "โอมาน" },
  { code: "PAK", a2: "pk", en: "Pakistan", fr: "Pakistan", es: "Pakistán", pt: "Paquistão", tr: "Pakistan", ja: "パキスタン", ko: "파키스탄", de: "Pakistan", zh: "巴基斯坦", it: "Pakistan", pl: "Pakistan", ar: "باكستان", th: "ปากีสถาน" },
  { code: "PLW", a2: "pw", en: "Palau", fr: "Palaos", es: "Palaos", pt: "Palau", tr: "Palau", ja: "パラオ", ko: "팔라우", de: "Palau", zh: "帕劳", it: "Palau", pl: "Palau", ar: "بالاو", th: "ปาเลา" },
  { code: "PSE", a2: "ps", en: "Palestine", fr: "Palestine", es: "Palestina", pt: "Territórios palestinos", tr: "Filistin", ja: "パレスチナ", ko: "팔레스타인 지구", de: "Palästina", zh: "巴勒斯坦", it: "Palestina", pl: "Palestyna", ar: "فلسطين", th: "ปาเลสไตน์" },
  { code: "PAN", a2: "pa", en: "Panama", fr: "Panama", es: "Panamá", pt: "Panamá", tr: "Panama", ja: "パナマ", ko: "파나마", de: "Panama", zh: "巴拿马", it: "Panama", pl: "Panama", ar: "بنما", th: "ปานามา" },
  { code: "PNG", a2: "pg", en: "Papua New Guinea", fr: "Papouasie-Nouvelle-Guinée", es: "Papúa Nueva Guinea", pt: "Papua-Nova Guiné", tr: "Papua Yeni Gine", ja: "パプアニューギニア", ko: "파푸아뉴기니", de: "Papua-Neuguinea", zh: "巴布亚新几内亚", it: "Papua Nuova Guinea", pl: "Papua-Nowa Gwinea", ar: "بابوا غينيا الجديدة", th: "ปาปัวนิวกินี" },
  { code: "PRY", a2: "py", en: "Paraguay", fr: "Paraguay", es: "Paraguay", pt: "Paraguai", tr: "Paraguay", ja: "パラグアイ", ko: "파라과이", de: "Paraguay", zh: "巴拉圭", it: "Paraguay", pl: "Paragwaj", ar: "باراغواي", th: "ปารากวัย" },
  { code: "PER", a2: "pe", en: "Peru", fr: "Pérou", es: "Perú", pt: "Peru", tr: "Peru", ja: "ペルー", ko: "페루", de: "Peru", zh: "秘鲁", it: "Perù", pl: "Peru", ar: "بيرو", th: "เปรู" },
  { code: "PHL", a2: "ph", en: "Philippines", fr: "Philippines", es: "Filipinas", pt: "Filipinas", tr: "Filipinler", ja: "フィリピン", ko: "필리핀", de: "Philippinen", zh: "菲律宾", it: "Filippine", pl: "Filipiny", ar: "الفلبين", th: "ฟิลิปปินส์" },
  { code: "POL", a2: "pl", en: "Poland", fr: "Pologne", es: "Polonia", pt: "Polônia", tr: "Polonya", ja: "ポーランド", ko: "폴란드", de: "Polen", zh: "波兰", it: "Polonia", pl: "Polska", ar: "بولندا", th: "โปแลนด์" },
  { code: "PRT", a2: "pt", en: "Portugal", fr: "Portugal", es: "Portugal", pt: "Portugal", tr: "Portekiz", ja: "ポルトガル", ko: "포르투갈", de: "Portugal", zh: "葡萄牙", it: "Portogallo", pl: "Portugalia", ar: "البرتغال", th: "โปรตุเกส" },
  { code: "QAT", a2: "qa", en: "Qatar", fr: "Qatar", es: "Catar", pt: "Catar", tr: "Katar", ja: "カタール", ko: "카타르", de: "Katar", zh: "卡塔尔", it: "Qatar", pl: "Katar", ar: "قطر", th: "กาตาร์" },
  { code: "ROU", a2: "ro", en: "Romania", fr: "Roumanie", es: "Rumanía", pt: "Romênia", tr: "Romanya", ja: "ルーマニア", ko: "루마니아", de: "Rumänien", zh: "罗马尼亚", it: "Romania", pl: "Rumunia", ar: "رومانيا", th: "โรมาเนีย" },
  { code: "RUS", a2: "ru", en: "Russia", fr: "Russie", es: "Rusia", pt: "Rússia", tr: "Rusya", ja: "ロシア", ko: "러시아", de: "Russland", zh: "俄罗斯", it: "Russia", pl: "Rosja", ar: "روسيا", th: "รัสเซีย" },
  { code: "RWA", a2: "rw", en: "Rwanda", fr: "Rwanda", es: "Ruanda", pt: "Ruanda", tr: "Ruanda", ja: "ルワンダ", ko: "르완다", de: "Ruanda", zh: "卢旺达", it: "Ruanda", pl: "Rwanda", ar: "رواندا", th: "รวันดา" },
  { code: "KNA", a2: "kn", en: "Saint Kitts and Nevis", fr: "Saint-Kitts-et-Nevis", es: "San Cristóbal y Nieves", pt: "São Cristóvão e Névis", tr: "Saint Kitts ve Nevis", ja: "セントクリストファー・ネーヴィス", ko: "세인트키츠 네비스", de: "St. Kitts und Nevis", zh: "圣基茨和尼维斯", it: "Saint Kitts e Nevis", pl: "Saint Kitts i Nevis", ar: "سانت كيتس ونيفيس", th: "เซนต์คิตส์และเนวิส" },
  { code: "LCA", a2: "lc", en: "Saint Lucia", fr: "Sainte-Lucie", es: "Santa Lucía", pt: "Santa Lúcia", tr: "Saint Lucia", ja: "セントルシア", ko: "세인트루시아", de: "St. Lucia", zh: "圣卢西亚", it: "Saint Lucia", pl: "Saint Lucia", ar: "سانت لوسيا", th: "เซนต์ลูเซีย" },
  { code: "VCT", a2: "vc", en: "Saint Vincent and the Grenadines", fr: "Saint-Vincent-et-les-Grenadines", es: "San Vicente y las Granadinas", pt: "São Vicente e Granadinas", tr: "Saint Vincent ve Grenadinler", ja: "セントビンセント及びグレナディーン諸島", ko: "세인트빈센트그레나딘", de: "St. Vincent und die Grenadinen", zh: "圣文森特和格林纳丁斯", it: "Saint Vincent e Grenadine", pl: "Saint Vincent i Grenadyny", ar: "سانت فنسنت وجزر غرينادين", th: "เซนต์วินเซนต์และเกรนาดีนส์" },
  { code: "WSM", a2: "ws", en: "Samoa", fr: "Samoa", es: "Samoa", pt: "Samoa", tr: "Samoa", ja: "サモア", ko: "사모아", de: "Samoa", zh: "萨摩亚", it: "Samoa", pl: "Samoa", ar: "ساموا", th: "ซามัว" },
  { code: "SMR", a2: "sm", en: "San Marino", fr: "Saint-Marin", es: "San Marino", pt: "San Marino", tr: "San Marino", ja: "サンマリノ", ko: "산마리노", de: "San Marino", zh: "圣马力诺", it: "San Marino", pl: "San Marino", ar: "سان مارينو", th: "ซานมาริโน" },
  { code: "STP", a2: "st", en: "São Tomé and Príncipe", fr: "Sao Tomé-et-Principe", es: "Santo Tomé y Príncipe", pt: "São Tomé e Príncipe", tr: "Sao Tome ve Principe", ja: "サントメ・プリンシペ", ko: "상투메 프린시페", de: "São Tomé und Príncipe", zh: "圣多美和普林西比", it: "São Tomé e Príncipe", pl: "Wyspy Świętego Tomasza i Książęca", ar: "ساو تومي وبرينسيبي", th: "เซาตูเมและปรินซิปี" },
  { code: "SAU", a2: "sa", en: "Saudi Arabia", fr: "Arabie saoudite", es: "Arabia Saudí", pt: "Arábia Saudita", tr: "Suudi Arabistan", ja: "サウジアラビア", ko: "사우디아라비아", de: "Saudi-Arabien", zh: "沙特阿拉伯", it: "Arabia Saudita", pl: "Arabia Saudyjska", ar: "المملكة العربية السعودية", th: "ซาอุดีอาระเบีย" },
  { code: "SEN", a2: "sn", en: "Senegal", fr: "Sénégal", es: "Senegal", pt: "Senegal", tr: "Senegal", ja: "セネガル", ko: "세네갈", de: "Senegal", zh: "塞内加尔", it: "Senegal", pl: "Senegal", ar: "السنغال", th: "เซเนกัล" },
  { code: "SRB", a2: "rs", en: "Serbia", fr: "Serbie", es: "Serbia", pt: "Sérvia", tr: "Sırbistan", ja: "セルビア", ko: "세르비아", de: "Serbien", zh: "塞尔维亚", it: "Serbia", pl: "Serbia", ar: "صربيا", th: "เซอร์เบีย" },
  { code: "SYC", a2: "sc", en: "Seychelles", fr: "Seychelles", es: "Seychelles", pt: "Seicheles", tr: "Seyşeller", ja: "セーシェル", ko: "세이셸", de: "Seychellen", zh: "塞舌尔", it: "Seychelles", pl: "Seszele", ar: "سيشل", th: "เซเชลส์" },
  { code: "SLE", a2: "sl", en: "Sierra Leone", fr: "Sierra Leone", es: "Sierra Leona", pt: "Serra Leoa", tr: "Sierra Leone", ja: "シエラレオネ", ko: "시에라리온", de: "Sierra Leone", zh: "塞拉利昂", it: "Sierra Leone", pl: "Sierra Leone", ar: "سيراليون", th: "เซียร์ราลีโอน" },
  { code: "SGP", a2: "sg", en: "Singapore", fr: "Singapour", es: "Singapur", pt: "Singapura", tr: "Singapur", ja: "シンガポール", ko: "싱가포르", de: "Singapur", zh: "新加坡", it: "Singapore", pl: "Singapur", ar: "سنغافورة", th: "สิงคโปร์" },
  { code: "SVK", a2: "sk", en: "Slovakia", fr: "Slovaquie", es: "Eslovaquia", pt: "Eslováquia", tr: "Slovakya", ja: "スロバキア", ko: "슬로바키아", de: "Slowakei", zh: "斯洛伐克", it: "Slovacchia", pl: "Słowacja", ar: "سلوفاكيا", th: "สโลวะเกีย" },
  { code: "SVN", a2: "si", en: "Slovenia", fr: "Slovénie", es: "Eslovenia", pt: "Eslovênia", tr: "Slovenya", ja: "スロベニア", ko: "슬로베니아", de: "Slowenien", zh: "斯洛文尼亚", it: "Slovenia", pl: "Słowenia", ar: "سلوفينيا", th: "สโลวีเนีย" },
  { code: "SLB", a2: "sb", en: "Solomon Islands", fr: "Îles Salomon", es: "Islas Salomón", pt: "Ilhas Salomão", tr: "Solomon Adaları", ja: "ソロモン諸島", ko: "솔로몬 제도", de: "Salomonen", zh: "所罗门群岛", it: "Isole Salomone", pl: "Wyspy Salomona", ar: "جزر سليمان", th: "หมู่เกาะโซโลมอน" },
  { code: "SOM", a2: "so", en: "Somalia", fr: "Somalie", es: "Somalia", pt: "Somália", tr: "Somali", ja: "ソマリア", ko: "소말리아", de: "Somalia", zh: "索马里", it: "Somalia", pl: "Somalia", ar: "الصومال", th: "โซมาเลีย" },
  { code: "ZAF", a2: "za", en: "South Africa", fr: "Afrique du Sud", es: "Sudáfrica", pt: "África do Sul", tr: "Güney Afrika", ja: "南アフリカ", ko: "남아프리카", de: "Südafrika", zh: "南非", it: "Sudafrica", pl: "Republika Południowej Afryki", ar: "جنوب أفريقيا", th: "แอฟริกาใต้" },
  { code: "KOR", a2: "kr", en: "South Korea", fr: "Corée du Sud", es: "Corea del Sur", pt: "Coreia do Sul", tr: "Güney Kore", ja: "韓国", ko: "대한민국", de: "Südkorea", zh: "韩国", it: "Corea del Sud", pl: "Korea Południowa", ar: "كوريا الجنوبية", th: "เกาหลีใต้" },
  { code: "SSD", a2: "ss", en: "South Sudan", fr: "Soudan du Sud", es: "Sudán del Sur", pt: "Sudão do Sul", tr: "Güney Sudan", ja: "南スーダン", ko: "남수단", de: "Südsudan", zh: "南苏丹", it: "Sud Sudan", pl: "Sudan Południowy", ar: "جنوب السودان", th: "ซูดานใต้" },
  { code: "ESP", a2: "es", en: "Spain", fr: "Espagne", es: "España", pt: "Espanha", tr: "İspanya", ja: "スペイン", ko: "스페인", de: "Spanien", zh: "西班牙", it: "Spagna", pl: "Hiszpania", ar: "إسبانيا", th: "สเปน" },
  { code: "LKA", a2: "lk", en: "Sri Lanka", fr: "Sri Lanka", es: "Sri Lanka", pt: "Sri Lanka", tr: "Sri Lanka", ja: "スリランカ", ko: "스리랑카", de: "Sri Lanka", zh: "斯里兰卡", it: "Sri Lanka", pl: "Sri Lanka", ar: "سريلانكا", th: "ศรีลังกา" },
  { code: "SDN", a2: "sd", en: "Sudan", fr: "Soudan", es: "Sudán", pt: "Sudão", tr: "Sudan", ja: "スーダン", ko: "수단", de: "Sudan", zh: "苏丹", it: "Sudan", pl: "Sudan", ar: "السودان", th: "ซูดาน" },
  { code: "SUR", a2: "sr", en: "Suriname", fr: "Suriname", es: "Surinam", pt: "Suriname", tr: "Surinam", ja: "スリナム", ko: "수리남", de: "Suriname", zh: "苏里南", it: "Suriname", pl: "Surinam", ar: "سورينام", th: "ซูรินาเม" },
  { code: "SWE", a2: "se", en: "Sweden", fr: "Suède", es: "Suecia", pt: "Suécia", tr: "İsveç", ja: "スウェーデン", ko: "스웨덴", de: "Schweden", zh: "瑞典", it: "Svezia", pl: "Szwecja", ar: "السويد", th: "สวีเดน" },
  { code: "CHE", a2: "ch", en: "Switzerland", fr: "Suisse", es: "Suiza", pt: "Suíça", tr: "İsviçre", ja: "スイス", ko: "스위스", de: "Schweiz", zh: "瑞士", it: "Svizzera", pl: "Szwajcaria", ar: "سويسرا", th: "สวิตเซอร์แลนด์" },
  { code: "SYR", a2: "sy", en: "Syria", fr: "Syrie", es: "Siria", pt: "Síria", tr: "Suriye", ja: "シリア", ko: "시리아", de: "Syrien", zh: "叙利亚", it: "Siria", pl: "Syria", ar: "سوريا", th: "ซีเรีย" },
  { code: "TWN", a2: "tw", en: "Taiwan", fr: "Taïwan", es: "Taiwán", pt: "Taiwan", tr: "Tayvan", ja: "台湾", ko: "대만", de: "Taiwan", zh: "台湾", it: "Taiwan", pl: "Tajwan", ar: "تايوان", th: "ไต้หวัน" },
  { code: "TJK", a2: "tj", en: "Tajikistan", fr: "Tadjikistan", es: "Tayikistán", pt: "Tadjiquistão", tr: "Tacikistan", ja: "タジキスタン", ko: "타지키스탄", de: "Tadschikistan", zh: "塔吉克斯坦", it: "Tagikistan", pl: "Tadżykistan", ar: "طاجيكستان", th: "ทาจิกิสถาน" },
  { code: "TZA", a2: "tz", en: "Tanzania", fr: "Tanzanie", es: "Tanzania", pt: "Tanzânia", tr: "Tanzanya", ja: "タンザニア", ko: "탄자니아", de: "Tansania", zh: "坦桑尼亚", it: "Tanzania", pl: "Tanzania", ar: "تنزانيا", th: "แทนซาเนีย" },
  { code: "THA", a2: "th", en: "Thailand", fr: "Thaïlande", es: "Tailandia", pt: "Tailândia", tr: "Tayland", ja: "タイ", ko: "태국", de: "Thailand", zh: "泰国", it: "Thailandia", pl: "Tajlandia", ar: "تايلاند", th: "ไทย" },
  { code: "TLS", a2: "tl", en: "Timor-Leste", fr: "Timor oriental", es: "Timor Oriental", pt: "Timor-Leste", tr: "Timor-Leste", ja: "東ティモール", ko: "동티모르", de: "Timor-Leste", zh: "东帝汶", it: "Timor Est", pl: "Timor Wschodni", ar: "تيمور الشرقية", th: "ติมอร์ตะวันออก" },
  { code: "TGO", a2: "tg", en: "Togo", fr: "Togo", es: "Togo", pt: "Togo", tr: "Togo", ja: "トーゴ", ko: "토고", de: "Togo", zh: "多哥", it: "Togo", pl: "Togo", ar: "توغو", th: "โตโก" },
  { code: "TON", a2: "to", en: "Tonga", fr: "Tonga", es: "Tonga", pt: "Tonga", tr: "Tonga", ja: "トンガ", ko: "통가", de: "Tonga", zh: "汤加", it: "Tonga", pl: "Tonga", ar: "تونغا", th: "ตองกา" },
  { code: "TTO", a2: "tt", en: "Trinidad and Tobago", fr: "Trinité-et-Tobago", es: "Trinidad y Tobago", pt: "Trinidad e Tobago", tr: "Trinidad ve Tobago", ja: "トリニダード・トバゴ", ko: "트리니다드 토바고", de: "Trinidad und Tobago", zh: "特立尼达和多巴哥", it: "Trinidad e Tobago", pl: "Trynidad i Tobago", ar: "ترينيداد وتوباغو", th: "ตรินิแดดและโตเบโก" },
  { code: "TUN", a2: "tn", en: "Tunisia", fr: "Tunisie", es: "Túnez", pt: "Tunísia", tr: "Tunus", ja: "チュニジア", ko: "튀니지", de: "Tunesien", zh: "突尼斯", it: "Tunisia", pl: "Tunezja", ar: "تونس", th: "ตูนิเซีย" },
  { code: "TUR", a2: "tr", en: "Turkey", fr: "Turquie", es: "Turquía", pt: "Turquia", tr: "Türkiye", ja: "トルコ", ko: "튀르키예", de: "Türkei", zh: "土耳其", it: "Turchia", pl: "Turcja", ar: "تركيا", th: "ตุรกี" },
  { code: "TKM", a2: "tm", en: "Turkmenistan", fr: "Turkménistan", es: "Turkmenistán", pt: "Turcomenistão", tr: "Türkmenistan", ja: "トルクメニスタン", ko: "투르크메니스탄", de: "Turkmenistan", zh: "土库曼斯坦", it: "Turkmenistan", pl: "Turkmenistan", ar: "تركمانستان", th: "เติร์กเมนิสถาน" },
  { code: "TUV", a2: "tv", en: "Tuvalu", fr: "Tuvalu", es: "Tuvalu", pt: "Tuvalu", tr: "Tuvalu", ja: "ツバル", ko: "투발루", de: "Tuvalu", zh: "图瓦卢", it: "Tuvalu", pl: "Tuvalu", ar: "توفالو", th: "ตูวาลู" },
  { code: "UGA", a2: "ug", en: "Uganda", fr: "Ouganda", es: "Uganda", pt: "Uganda", tr: "Uganda", ja: "ウガンダ", ko: "우간다", de: "Uganda", zh: "乌干达", it: "Uganda", pl: "Uganda", ar: "أوغندا", th: "ยูกันดา" },
  { code: "UKR", a2: "ua", en: "Ukraine", fr: "Ukraine", es: "Ucrania", pt: "Ucrânia", tr: "Ukrayna", ja: "ウクライナ", ko: "우크라이나", de: "Ukraine", zh: "乌克兰", it: "Ucraina", pl: "Ukraina", ar: "أوكرانيا", th: "ยูเครน" },
  { code: "ARE", a2: "ae", en: "United Arab Emirates", fr: "Émirats arabes unis", es: "Emiratos Árabes Unidos", pt: "Emirados Árabes Unidos", tr: "Birleşik Arap Emirlikleri", ja: "アラブ首長国連邦", ko: "아랍에미리트", de: "Vereinigte Arabische Emirate", zh: "阿拉伯联合酋长国", it: "Emirati Arabi Uniti", pl: "Zjednoczone Emiraty Arabskie", ar: "الإمارات العربية المتحدة", th: "สหรัฐอาหรับเอมิเรตส์" },
  { code: "GBR", a2: "gb", en: "United Kingdom", fr: "Royaume-Uni", es: "Reino Unido", pt: "Reino Unido", tr: "Birleşik Krallık", ja: "イギリス", ko: "영국", de: "Vereinigtes Königreich", zh: "英国", it: "Regno Unito", pl: "Wielka Brytania", ar: "المملكة المتحدة", th: "สหราชอาณาจักร" },
  { code: "ENG", a2: "gb-eng", en: "England", fr: "Angleterre", es: "Inglaterra", pt: "Inglaterra", tr: "İngiltere", ja: "イングランド", ko: "잉글랜드", de: "England", zh: "英格兰", it: "Inghilterra", pl: "Anglia", ar: "إنجلترا", th: "อังกฤษ" },
  { code: "SCO", a2: "gb-sct", en: "Scotland", fr: "Écosse", es: "Escocia", pt: "Escócia", tr: "İskoçya", ja: "スコットランド", ko: "스코틀랜드", de: "Schottland", zh: "苏格兰", it: "Scozia", pl: "Szkocja", ar: "اسكتلندا", th: "สกอตแลนด์" },
  { code: "WAL", a2: "gb-wls", en: "Wales", fr: "Pays de Galles", es: "Gales", pt: "País de Gales", tr: "Galler", ja: "ウェールズ", ko: "웨일스", de: "Wales", zh: "威尔士", it: "Galles", pl: "Walia", ar: "ويلز", th: "เวลส์" },
  { code: "NIR", a2: "gb-nir", en: "Northern Ireland", fr: "Irlande du Nord", es: "Irlanda del Norte", pt: "Irlanda do Norte", tr: "Kuzey İrlanda", ja: "北アイルランド", ko: "북아일랜드", de: "Nordirland", zh: "北爱尔兰", it: "Irlanda del Nord", pl: "Irlandia Północna", ar: "أيرلندا الشمالية", th: "ไอร์แลนด์เหนือ" },
  { code: "USA", a2: "us", en: "United States", fr: "États-Unis", es: "Estados Unidos", pt: "Estados Unidos", tr: "Amerika Birleşik Devletleri", ja: "アメリカ合衆国", ko: "미국", de: "Vereinigte Staaten", zh: "美国", it: "Stati Uniti", pl: "Stany Zjednoczone", ar: "الولايات المتحدة", th: "สหรัฐอเมริกา" },
  { code: "URY", a2: "uy", en: "Uruguay", fr: "Uruguay", es: "Uruguay", pt: "Uruguai", tr: "Uruguay", ja: "ウルグアイ", ko: "우루과이", de: "Uruguay", zh: "乌拉圭", it: "Uruguay", pl: "Urugwaj", ar: "أورغواي", th: "อุรุกวัย" },
  { code: "UZB", a2: "uz", en: "Uzbekistan", fr: "Ouzbékistan", es: "Uzbekistán", pt: "Uzbequistão", tr: "Özbekistan", ja: "ウズベキスタン", ko: "우즈베키스탄", de: "Usbekistan", zh: "乌兹别克斯坦", it: "Uzbekistan", pl: "Uzbekistan", ar: "أوزبكستان", th: "อุซเบกิสถาน" },
  { code: "VUT", a2: "vu", en: "Vanuatu", fr: "Vanuatu", es: "Vanuatu", pt: "Vanuatu", tr: "Vanuatu", ja: "バヌアツ", ko: "바누아투", de: "Vanuatu", zh: "瓦努阿图", it: "Vanuatu", pl: "Vanuatu", ar: "فانواتو", th: "วานูอาตู" },
  { code: "VAT", a2: "va", en: "Vatican City", fr: "Vatican", es: "Ciudad del Vaticano", pt: "Cidade do Vaticano", tr: "Vatikan", ja: "バチカン市国", ko: "바티칸 시국", de: "Vatikanstadt", zh: "梵蒂冈", it: "Città del Vaticano", pl: "Watykan", ar: "الفاتيكان", th: "นครวาติกัน" },
  { code: "VEN", a2: "ve", en: "Venezuela", fr: "Venezuela", es: "Venezuela", pt: "Venezuela", tr: "Venezuela", ja: "ベネズエラ", ko: "베네수엘라", de: "Venezuela", zh: "委内瑞拉", it: "Venezuela", pl: "Wenezuela", ar: "فنزويلا", th: "เวเนซุเอลา" },
  { code: "VNM", a2: "vn", en: "Vietnam", fr: "Viêt Nam", es: "Vietnam", pt: "Vietnã", tr: "Vietnam", ja: "ベトナム", ko: "베트남", de: "Vietnam", zh: "越南", it: "Vietnam", pl: "Wietnam", ar: "فيتنام", th: "เวียดนาม" },
  { code: "YEM", a2: "ye", en: "Yemen", fr: "Yémen", es: "Yemen", pt: "Iêmen", tr: "Yemen", ja: "イエメン", ko: "예멘", de: "Jemen", zh: "也门", it: "Yemen", pl: "Jemen", ar: "اليمن", th: "เยเมน" },
  { code: "ZMB", a2: "zm", en: "Zambia", fr: "Zambie", es: "Zambia", pt: "Zâmbia", tr: "Zambiya", ja: "ザンビア", ko: "잠비아", de: "Sambia", zh: "赞比亚", it: "Zambia", pl: "Zambia", ar: "زامبيا", th: "แซมเบีย" },
  { code: "ZWE", a2: "zw", en: "Zimbabwe", fr: "Zimbabwe", es: "Zimbabue", pt: "Zimbábue", tr: "Zimbabve", ja: "ジンバブエ", ko: "짐바브웨", de: "Simbabwe", zh: "津巴布韦", it: "Zimbabwe", pl: "Zimbabwe", ar: "زيمبابوي", th: "ซิมบับเว" },
];

/** International-code entry first, then every real ISO country sorted by the given locale name. */
export function countryList(locale: AppLocale): Country[] {
  const intl: Country = INTERNATIONAL;
  const sorted = [...COUNTRIES].sort((a, b) => a[locale].localeCompare(b[locale], locale));
  return [intl, ...sorted];
}

export function countryName(code: string | null, locale: AppLocale): string | null {
  if (!code) return null;
  if (code === INTERNATIONAL_CODE) return INTERNATIONAL[locale];
  return COUNTRIES.find((c) => c.code === code)?.[locale] ?? code;
}

/** "France" or, with a distinct second nationality, "France / Belgique". */
export function countryNames(code: string | null, secondaryCode: string | null | undefined, locale: AppLocale): string | null {
  const primary = countryName(code, locale);
  const secondary = secondaryCode && secondaryCode !== code ? countryName(secondaryCode, locale) : null;
  if (!primary) return secondary;
  return secondary ? `${primary} / ${secondary}` : primary;
}

export function countryFlagClass(code: string | null): string | null {
  if (!code || code === INTERNATIONAL_CODE) return null;
  const country = COUNTRIES.find((c) => c.code === code);
  return country ? `fi-${country.a2}` : null;
}

export function isValidCountryCode(code: string): boolean {
  return code === INTERNATIONAL_CODE || COUNTRIES.some((c) => c.code === code);
}

// Stream/VOD `language_code` columns store lowercase ISO alpha-2 codes
// directly (not the alpha-3 codes above) — same flag-icons key as V1's
// `App\Support\Countries::list()`, with the synthetic 'inter' sentinel
// mapped to the UN flag (V1's fi-un special case).
export function languageFlagClass(code: string | null | undefined): string {
  if (!code) return "fi-un";
  const trimmed = code.trim().toLowerCase();
  return trimmed === "inter" ? "fi-un" : `fi-${trimmed}`;
}
