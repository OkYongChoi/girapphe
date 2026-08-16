import type { Locale } from './locale';

export const DOMAIN_NAMES = [
  'AI Safety', 'Algorithms', 'Artificial Intelligence', 'Biology', 'Calculus', 'Chemistry',
  'Circuits & Electromagnetics', 'Cloud & DevOps', 'Compilers', 'Complex Systems', 'Complexity Theory',
  'Computer Architecture', 'Computer Graphics', 'Computer Science', 'Computer Vision', 'Control Systems',
  'Data Structures', 'Databases', 'Deep Learning', 'Distributed Systems', 'Electromagnetics', 'Embedded Systems',
  'Engineering Science', 'Fluid Mechanics', 'Heat Transfer', 'Information Theory', 'Instrumentation', 'IoT',
  'Linear Algebra', 'Machine Learning', 'Materials Science', 'Mathematics', 'Mechanics & Materials', 'NLP',
  'Networking', 'Numerical Methods', 'OS', 'Operating Systems', 'Optimization', 'Physics', 'Plasma & MHD',
  'Power Electronics', 'Probability & Statistics', 'Programming Languages', 'RF & Analog',
  'Reinforcement Learning', 'Robotics', 'Security', 'Semiconductor', 'Semiconductor Devices',
  'Signal Processing', 'Software Engineering', 'Statistics', 'Supervised Learning', 'Theoretical CS',
  'Theoretical ML', 'Transport & Control', 'Unsupervised Learning',
] as const;

type DomainName = (typeof DOMAIN_NAMES)[number];
type TaxonomyLocale = Exclude<Locale, 'en'>;

const domains = {
  ja: {
    'AI Safety': 'AI安全性', 'Algorithms': 'アルゴリズム', 'Artificial Intelligence': '人工知能', 'Biology': '生物学', 'Calculus': '微積分学', 'Chemistry': '化学',
    'Circuits & Electromagnetics': '回路と電磁気学', 'Cloud & DevOps': 'クラウドとDevOps', 'Compilers': 'コンパイラ', 'Complex Systems': '複雑系', 'Complexity Theory': '計算複雑性理論',
    'Computer Architecture': 'コンピュータアーキテクチャ', 'Computer Graphics': 'コンピュータグラフィックス', 'Computer Science': 'コンピュータ科学', 'Computer Vision': 'コンピュータビジョン', 'Control Systems': '制御システム',
    'Data Structures': 'データ構造', 'Databases': 'データベース', 'Deep Learning': '深層学習', 'Distributed Systems': '分散システム', 'Electromagnetics': '電磁気学', 'Embedded Systems': '組み込みシステム',
    'Engineering Science': '工学基礎', 'Fluid Mechanics': '流体力学', 'Heat Transfer': '伝熱工学', 'Information Theory': '情報理論', 'Instrumentation': '計測工学', 'IoT': 'モノのインターネット',
    'Linear Algebra': '線形代数', 'Machine Learning': '機械学習', 'Materials Science': '材料科学', 'Mathematics': '数学', 'Mechanics & Materials': '力学と材料', 'NLP': '自然言語処理',
    'Networking': 'ネットワーク', 'Numerical Methods': '数値計算法', 'OS': 'オペレーティングシステム', 'Operating Systems': 'オペレーティングシステム', 'Optimization': '最適化', 'Physics': '物理学', 'Plasma & MHD': 'プラズマと電磁流体力学',
    'Power Electronics': 'パワーエレクトロニクス', 'Probability & Statistics': '確率と統計', 'Programming Languages': 'プログラミング言語', 'RF & Analog': '高周波とアナログ',
    'Reinforcement Learning': '強化学習', 'Robotics': 'ロボティクス', 'Security': 'セキュリティ', 'Semiconductor': '半導体', 'Semiconductor Devices': '半導体デバイス',
    'Signal Processing': '信号処理', 'Software Engineering': 'ソフトウェア工学', 'Statistics': '統計学', 'Supervised Learning': '教師あり学習', 'Theoretical CS': '理論計算機科学',
    'Theoretical ML': '機械学習理論', 'Transport & Control': '輸送現象と制御', 'Unsupervised Learning': '教師なし学習',
  },
  'zh-CN': {
    'AI Safety': 'AI 安全', 'Algorithms': '算法', 'Artificial Intelligence': '人工智能', 'Biology': '生物学', 'Calculus': '微积分', 'Chemistry': '化学',
    'Circuits & Electromagnetics': '电路与电磁学', 'Cloud & DevOps': '云与 DevOps', 'Compilers': '编译器', 'Complex Systems': '复杂系统', 'Complexity Theory': '复杂性理论',
    'Computer Architecture': '计算机体系结构', 'Computer Graphics': '计算机图形学', 'Computer Science': '计算机科学', 'Computer Vision': '计算机视觉', 'Control Systems': '控制系统',
    'Data Structures': '数据结构', 'Databases': '数据库', 'Deep Learning': '深度学习', 'Distributed Systems': '分布式系统', 'Electromagnetics': '电磁学', 'Embedded Systems': '嵌入式系统',
    'Engineering Science': '工程科学', 'Fluid Mechanics': '流体力学', 'Heat Transfer': '传热学', 'Information Theory': '信息论', 'Instrumentation': '仪器与测量', 'IoT': '物联网',
    'Linear Algebra': '线性代数', 'Machine Learning': '机器学习', 'Materials Science': '材料科学', 'Mathematics': '数学', 'Mechanics & Materials': '力学与材料', 'NLP': '自然语言处理',
    'Networking': '计算机网络', 'Numerical Methods': '数值方法', 'OS': '操作系统', 'Operating Systems': '操作系统', 'Optimization': '优化', 'Physics': '物理学', 'Plasma & MHD': '等离子体与磁流体力学',
    'Power Electronics': '电力电子', 'Probability & Statistics': '概率与统计', 'Programming Languages': '编程语言', 'RF & Analog': '射频与模拟电路',
    'Reinforcement Learning': '强化学习', 'Robotics': '机器人学', 'Security': '安全', 'Semiconductor': '半导体', 'Semiconductor Devices': '半导体器件',
    'Signal Processing': '信号处理', 'Software Engineering': '软件工程', 'Statistics': '统计学', 'Supervised Learning': '监督学习', 'Theoretical CS': '理论计算机科学',
    'Theoretical ML': '机器学习理论', 'Transport & Control': '传输与控制', 'Unsupervised Learning': '无监督学习',
  },
  es: {
    'AI Safety': 'Seguridad de la IA', 'Algorithms': 'Algoritmos', 'Artificial Intelligence': 'Inteligencia artificial', 'Biology': 'Biología', 'Calculus': 'Cálculo', 'Chemistry': 'Química',
    'Circuits & Electromagnetics': 'Circuitos y electromagnetismo', 'Cloud & DevOps': 'Nube y DevOps', 'Compilers': 'Compiladores', 'Complex Systems': 'Sistemas complejos', 'Complexity Theory': 'Teoría de la complejidad',
    'Computer Architecture': 'Arquitectura de computadores', 'Computer Graphics': 'Gráficos por computadora', 'Computer Science': 'Informática', 'Computer Vision': 'Visión por computadora', 'Control Systems': 'Sistemas de control',
    'Data Structures': 'Estructuras de datos', 'Databases': 'Bases de datos', 'Deep Learning': 'Aprendizaje profundo', 'Distributed Systems': 'Sistemas distribuidos', 'Electromagnetics': 'Electromagnetismo', 'Embedded Systems': 'Sistemas embebidos',
    'Engineering Science': 'Ciencias de la ingeniería', 'Fluid Mechanics': 'Mecánica de fluidos', 'Heat Transfer': 'Transferencia de calor', 'Information Theory': 'Teoría de la información', 'Instrumentation': 'Instrumentación', 'IoT': 'Internet de las cosas',
    'Linear Algebra': 'Álgebra lineal', 'Machine Learning': 'Aprendizaje automático', 'Materials Science': 'Ciencia de materiales', 'Mathematics': 'Matemáticas', 'Mechanics & Materials': 'Mecánica y materiales', 'NLP': 'Procesamiento del lenguaje natural',
    'Networking': 'Redes', 'Numerical Methods': 'Métodos numéricos', 'OS': 'Sistemas operativos', 'Operating Systems': 'Sistemas operativos', 'Optimization': 'Optimización', 'Physics': 'Física', 'Plasma & MHD': 'Plasma y magnetohidrodinámica',
    'Power Electronics': 'Electrónica de potencia', 'Probability & Statistics': 'Probabilidad y estadística', 'Programming Languages': 'Lenguajes de programación', 'RF & Analog': 'Radiofrecuencia y analógica',
    'Reinforcement Learning': 'Aprendizaje por refuerzo', 'Robotics': 'Robótica', 'Security': 'Seguridad', 'Semiconductor': 'Semiconductores', 'Semiconductor Devices': 'Dispositivos semiconductores',
    'Signal Processing': 'Procesamiento de señales', 'Software Engineering': 'Ingeniería de software', 'Statistics': 'Estadística', 'Supervised Learning': 'Aprendizaje supervisado', 'Theoretical CS': 'Informática teórica',
    'Theoretical ML': 'Teoría del aprendizaje automático', 'Transport & Control': 'Transporte y control', 'Unsupervised Learning': 'Aprendizaje no supervisado',
  },
  ar: {
    'AI Safety': 'سلامة الذكاء الاصطناعي', 'Algorithms': 'الخوارزميات', 'Artificial Intelligence': 'الذكاء الاصطناعي', 'Biology': 'علم الأحياء', 'Calculus': 'حساب التفاضل والتكامل', 'Chemistry': 'الكيمياء',
    'Circuits & Electromagnetics': 'الدوائر والكهرومغناطيسية', 'Cloud & DevOps': 'السحابة وDevOps', 'Compilers': 'المصرّفات', 'Complex Systems': 'الأنظمة المعقّدة', 'Complexity Theory': 'نظرية التعقيد',
    'Computer Architecture': 'معمارية الحاسوب', 'Computer Graphics': 'رسوميات الحاسوب', 'Computer Science': 'علوم الحاسوب', 'Computer Vision': 'الرؤية الحاسوبية', 'Control Systems': 'أنظمة التحكم',
    'Data Structures': 'هياكل البيانات', 'Databases': 'قواعد البيانات', 'Deep Learning': 'التعلم العميق', 'Distributed Systems': 'الأنظمة الموزعة', 'Electromagnetics': 'الكهرومغناطيسية', 'Embedded Systems': 'الأنظمة المضمنة',
    'Engineering Science': 'العلوم الهندسية', 'Fluid Mechanics': 'ميكانيكا الموائع', 'Heat Transfer': 'انتقال الحرارة', 'Information Theory': 'نظرية المعلومات', 'Instrumentation': 'أجهزة القياس', 'IoT': 'إنترنت الأشياء',
    'Linear Algebra': 'الجبر الخطي', 'Machine Learning': 'تعلم الآلة', 'Materials Science': 'علم المواد', 'Mathematics': 'الرياضيات', 'Mechanics & Materials': 'الميكانيكا والمواد', 'NLP': 'معالجة اللغة الطبيعية',
    'Networking': 'الشبكات', 'Numerical Methods': 'الطرق العددية', 'OS': 'أنظمة التشغيل', 'Operating Systems': 'أنظمة التشغيل', 'Optimization': 'التحسين', 'Physics': 'الفيزياء', 'Plasma & MHD': 'البلازما والديناميكا المغناطيسية للموائع',
    'Power Electronics': 'إلكترونيات القدرة', 'Probability & Statistics': 'الاحتمالات والإحصاء', 'Programming Languages': 'لغات البرمجة', 'RF & Analog': 'الترددات الراديوية والتناظرية',
    'Reinforcement Learning': 'التعلم المعزز', 'Robotics': 'الروبوتات', 'Security': 'الأمن', 'Semiconductor': 'أشباه الموصلات', 'Semiconductor Devices': 'أجهزة أشباه الموصلات',
    'Signal Processing': 'معالجة الإشارات', 'Software Engineering': 'هندسة البرمجيات', 'Statistics': 'الإحصاء', 'Supervised Learning': 'التعلم الخاضع للإشراف', 'Theoretical CS': 'علوم الحاسوب النظرية',
    'Theoretical ML': 'نظرية تعلم الآلة', 'Transport & Control': 'النقل والتحكم', 'Unsupervised Learning': 'التعلم غير الخاضع للإشراف',
  },
  hi: {
    'AI Safety': 'AI सुरक्षा', 'Algorithms': 'एल्गोरिदम', 'Artificial Intelligence': 'कृत्रिम बुद्धिमत्ता', 'Biology': 'जीवविज्ञान', 'Calculus': 'कलन', 'Chemistry': 'रसायन विज्ञान',
    'Circuits & Electromagnetics': 'परिपथ और विद्युतचुंबकत्व', 'Cloud & DevOps': 'क्लाउड और DevOps', 'Compilers': 'कंपाइलर', 'Complex Systems': 'जटिल तंत्र', 'Complexity Theory': 'जटिलता सिद्धांत',
    'Computer Architecture': 'कंप्यूटर संरचना', 'Computer Graphics': 'कंप्यूटर ग्राफ़िक्स', 'Computer Science': 'कंप्यूटर विज्ञान', 'Computer Vision': 'कंप्यूटर दृष्टि', 'Control Systems': 'नियंत्रण तंत्र',
    'Data Structures': 'डेटा संरचनाएँ', 'Databases': 'डेटाबेस', 'Deep Learning': 'डीप लर्निंग', 'Distributed Systems': 'वितरित तंत्र', 'Electromagnetics': 'विद्युतचुंबकत्व', 'Embedded Systems': 'एम्बेडेड तंत्र',
    'Engineering Science': 'अभियांत्रिकी विज्ञान', 'Fluid Mechanics': 'द्रव यांत्रिकी', 'Heat Transfer': 'ऊष्मा अंतरण', 'Information Theory': 'सूचना सिद्धांत', 'Instrumentation': 'उपकरण विज्ञान', 'IoT': 'इंटरनेट ऑफ थिंग्स',
    'Linear Algebra': 'रैखिक बीजगणित', 'Machine Learning': 'मशीन लर्निंग', 'Materials Science': 'पदार्थ विज्ञान', 'Mathematics': 'गणित', 'Mechanics & Materials': 'यांत्रिकी और पदार्थ', 'NLP': 'प्राकृतिक भाषा प्रसंस्करण',
    'Networking': 'नेटवर्किंग', 'Numerical Methods': 'संख्यात्मक विधियाँ', 'OS': 'ऑपरेटिंग सिस्टम', 'Operating Systems': 'ऑपरेटिंग सिस्टम', 'Optimization': 'अनुकूलन', 'Physics': 'भौतिक विज्ञान', 'Plasma & MHD': 'प्लाज़्मा और चुंबकीय द्रवगतिकी',
    'Power Electronics': 'पावर इलेक्ट्रॉनिक्स', 'Probability & Statistics': 'प्रायिकता और सांख्यिकी', 'Programming Languages': 'प्रोग्रामिंग भाषाएँ', 'RF & Analog': 'रेडियो आवृत्ति और एनालॉग',
    'Reinforcement Learning': 'प्रबलन अधिगम', 'Robotics': 'रोबोटिक्स', 'Security': 'सुरक्षा', 'Semiconductor': 'अर्धचालक', 'Semiconductor Devices': 'अर्धचालक युक्तियाँ',
    'Signal Processing': 'संकेत प्रसंस्करण', 'Software Engineering': 'सॉफ़्टवेयर अभियांत्रिकी', 'Statistics': 'सांख्यिकी', 'Supervised Learning': 'पर्यवेक्षित अधिगम', 'Theoretical CS': 'सैद्धांतिक कंप्यूटर विज्ञान',
    'Theoretical ML': 'सैद्धांतिक मशीन लर्निंग', 'Transport & Control': 'परिवहन और नियंत्रण', 'Unsupervised Learning': 'अपर्यवेक्षित अधिगम',
  },
} satisfies Record<TaxonomyLocale, Record<DomainName, string>>;

const types = {
  ja: { algorithm: 'アルゴリズム', concept: '概念', model: 'モデル', theorem: '定理', prerequisite: '前提', related: '関連', generalizes: '一般化', derived_from: '派生元', equivalent_to: '同値' },
  'zh-CN': { algorithm: '算法', concept: '概念', model: '模型', theorem: '定理', prerequisite: '前置知识', related: '相关', generalizes: '泛化', derived_from: '派生自', equivalent_to: '等价于' },
  es: { algorithm: 'algoritmo', concept: 'concepto', model: 'modelo', theorem: 'teorema', prerequisite: 'prerrequisito', related: 'relacionado', generalizes: 'generaliza', derived_from: 'derivado de', equivalent_to: 'equivalente a' },
  ar: { algorithm: 'خوارزمية', concept: 'مفهوم', model: 'نموذج', theorem: 'مبرهنة', prerequisite: 'متطلب سابق', related: 'مرتبط', generalizes: 'يعمّم', derived_from: 'مشتق من', equivalent_to: 'مكافئ لـ' },
  hi: { algorithm: 'एल्गोरिदम', concept: 'अवधारणा', model: 'मॉडल', theorem: 'प्रमेय', prerequisite: 'पूर्व-आवश्यकता', related: 'संबंधित', generalizes: 'सामान्यीकृत करता है', derived_from: 'से व्युत्पन्न', equivalent_to: 'के समतुल्य' },
} satisfies Record<TaxonomyLocale, Record<'algorithm' | 'concept' | 'model' | 'theorem' | 'prerequisite' | 'related' | 'generalizes' | 'derived_from' | 'equivalent_to', string>>;

const levels = {
  ja: { memorize: '記憶', understand: '理解', connect: '関連付け', apply: '応用' },
  'zh-CN': { memorize: '记忆', understand: '理解', connect: '关联', apply: '应用' },
  es: { memorize: 'memorizar', understand: 'comprender', connect: 'conectar', apply: 'aplicar' },
  ar: { memorize: 'حفظ', understand: 'فهم', connect: 'ربط', apply: 'تطبيق' },
  hi: { memorize: 'याद करें', understand: 'समझें', connect: 'जोड़ें', apply: 'लागू करें' },
} satisfies Record<TaxonomyLocale, Record<'memorize' | 'understand' | 'connect' | 'apply', string>>;

const extraDomains = {
  ja: { Personal: '個人', Other: 'その他', Signal: '信号', Control: '制御', Info: '情報理論', ML: '機械学習', General: '一般' },
  'zh-CN': { Personal: '个人', Other: '其他', Signal: '信号', Control: '控制', Info: '信息论', ML: '机器学习', General: '通用' },
  es: { Personal: 'Personal', Other: 'Otros', Signal: 'Señales', Control: 'Control', Info: 'Teoría de la información', ML: 'Aprendizaje automático', General: 'General' },
  ar: { Personal: 'شخصي', Other: 'أخرى', Signal: 'إشارات', Control: 'تحكم', Info: 'نظرية المعلومات', ML: 'تعلم الآلة', General: 'عام' },
  hi: { Personal: 'व्यक्तिगत', Other: 'अन्य', Signal: 'संकेत', Control: 'नियंत्रण', Info: 'सूचना सिद्धांत', ML: 'मशीन लर्निंग', General: 'सामान्य' },
} satisfies Record<TaxonomyLocale, Record<'Personal' | 'Other' | 'Signal' | 'Control' | 'Info' | 'ML' | 'General', string>>;

function humanizeTaxonomy(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'and') return '&';
      if (lower === 'devops') return 'DevOps';
      if (lower === 'iot') return 'IoT';
      if (['ai', 'cs', 'mhd', 'ml', 'nlp', 'os', 'rf', 'vlsi'].includes(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function localizeDomain(locale: Locale, domain: string): string {
  const canonical = humanizeTaxonomy(domain);
  if (locale === 'en') return canonical;
  return (domains[locale] as Record<string, string>)[canonical]
    ?? (extraDomains[locale] as Record<string, string>)[canonical]
    ?? canonical;
}

export function localizeType(locale: Locale, type: string): string {
  const normalized = type.trim().toLowerCase();
  if (locale === 'en') return humanizeTaxonomy(normalized);
  return (types[locale] as Record<string, string>)[normalized] ?? humanizeTaxonomy(normalized);
}

export function localizeLevel(locale: Locale, level: string): string {
  const normalized = level.trim().toLowerCase();
  if (locale === 'en') return humanizeTaxonomy(normalized);
  return (levels[locale] as Record<string, string>)[normalized] ?? humanizeTaxonomy(normalized);
}
