import { hashPassword } from './auth.ts';
import type {
  Ebook,
  HomeworkAssignment,
  HomeworkSubmission,
  LanguageCourse,
  LanguageLevel,
  NotificationItem,
  SchoolTest,
  SubjectInfo,
  TestAttemptResult,
  TestQuestion,
  UserProfile,
  VideoLesson,
} from '../src/types/lms.ts';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export const SCHOOL_SUBJECTS: SubjectInfo[] = [
  { id: 'math', nameUz: 'Matematika', nameRu: 'Математика', nameEn: 'Mathematics', minGrade: 1, maxGrade: 11, category: 'stem' },
  { id: 'native_lang', nameUz: 'Ona tili', nameRu: 'Родной язык', nameEn: 'Native Language', minGrade: 1, maxGrade: 11, category: 'humanities' },
  { id: 'literature', nameUz: 'Adabiyot', nameRu: 'Литература', nameEn: 'Literature', minGrade: 1, maxGrade: 11, category: 'humanities' },
  { id: 'english', nameUz: 'Ingliz tili', nameRu: 'Английский язык', nameEn: 'English Language', minGrade: 1, maxGrade: 11, category: 'languages' },
  { id: 'russian', nameUz: 'Rus tili', nameRu: 'Русский язык', nameEn: 'Russian Language', minGrade: 1, maxGrade: 11, category: 'languages' },
  { id: 'science', nameUz: 'Tabiiy fanlar', nameRu: 'Естествознание', nameEn: 'Natural Science', minGrade: 1, maxGrade: 6, category: 'stem' },
  { id: 'physics', nameUz: 'Fizika', nameRu: 'Физика', nameEn: 'Physics', minGrade: 6, maxGrade: 11, category: 'stem' },
  { id: 'chemistry', nameUz: 'Kimyo', nameRu: 'Химия', nameEn: 'Chemistry', minGrade: 7, maxGrade: 11, category: 'stem' },
  { id: 'biology', nameUz: 'Biologiya', nameRu: 'Биология', nameEn: 'Biology', minGrade: 5, maxGrade: 11, category: 'stem' },
  { id: 'history', nameUz: 'Tarix', nameRu: 'История', nameEn: 'History', minGrade: 5, maxGrade: 11, category: 'humanities' },
  { id: 'geography', nameUz: 'Geografiya', nameRu: 'География', nameEn: 'Geography', minGrade: 5, maxGrade: 11, category: 'humanities' },
  { id: 'informatics', nameUz: 'Informatika', nameRu: 'Информатика', nameEn: 'Computer Science', minGrade: 1, maxGrade: 11, category: 'tech' },
  { id: 'law', nameUz: 'Huquq', nameRu: 'Право', nameEn: 'Civic Law', minGrade: 8, maxGrade: 11, category: 'civic' },
  { id: 'tarbiya', nameUz: 'Tarbiya', nameRu: 'Воспитание', nameEn: 'Ethics & Character', minGrade: 1, maxGrade: 11, category: 'civic' },
];

// Curated educational YouTube videos (real Khan Academy / educational embeddable videos)
const VIDEO_POOL: Record<string, { url: string; topic: string; notes: string }[]> = {
  math: [
    { url: 'https://www.youtube.com/watch?v=NybHckSEQBI', topic: 'Sonlar va amallar tartibi', notes: 'Qo‘shish, ayirish, ko‘paytirish va bo‘lish amallarini bosqichma-bosqich bajarish qoidalari.' },
    { url: 'https://www.youtube.com/watch?v=LwCRRUa8yTU', topic: 'Kasrlar va foizlar', notes: 'Oddiy va o‘nli kasrlar ustida amallar, foizlarni hisoblash usullari.' },
    { url: 'https://www.youtube.com/watch?v=Kp2bYWRQylk', topic: 'Chiziqli va kvadrat tenglamalar', notes: 'Noma’lumni topish, diskriminant formulasi va grafik talqini.' },
  ],
  native_lang: [
    { url: 'https://www.youtube.com/watch?v=R6T9v0w3n5M', topic: 'So‘z turkumlari va imlo qoidalari', notes: 'Ot, sifat, son va fe’l turkumlarining gapdagi vazifasi hamda to‘g‘ri yozish me’yorlari.' },
    { url: 'https://www.youtube.com/watch?v=8ZhoeSaPF-k', topic: 'Gap bo‘laklari va tinish belgilari', notes: 'Ega, kesim, to‘ldiruvchi va aniqlovchini ajratish, vergul va tire qoidalari.' },
  ],
  literature: [
    { url: 'https://www.youtube.com/watch?v=MSYw502dJNY', topic: 'Badiiy asar tahlili va she’riyat', notes: 'Asar g‘oyasi, obrazlar tizimi va badiiy tasvir vositalari.' },
  ],
  english: [
    { url: 'https://www.youtube.com/watch?v=jul2HYFDgGk', topic: 'Present Simple & Everyday Dialogue', notes: 'Ingliz tilida kundalik suhbat tuzish va fe’l zamonlaridan to‘g‘ri foydalanish.' },
    { url: 'https://www.youtube.com/watch?v=6T9CYf2uTMI', topic: 'Past & Future Tenses in Practice', notes: 'O‘tgan va kelasi zamon shakllari hamda matn o‘qish texnikasi.' },
  ],
  russian: [
    { url: 'https://www.youtube.com/watch?v=4xK6J3iE6wI', topic: 'Rus tili grammatikasi va nutq o‘stirish', notes: 'Rus tilida rod (jins), kelishiklar va kundalik muloqot iboralari.' },
  ],
  science: [
    { url: 'https://www.youtube.com/watch?v=75g2L6fQ9jE', topic: 'Tabiat hodisalari va tirik organizmlar', notes: 'Suv aylanishi, o‘simliklar o‘sishi va ekologik muvozanat asoslari.' },
  ],
  physics: [
    { url: 'https://www.youtube.com/watch?v=kKKM8Y-u7ds', topic: 'Nyuton qonunlari va harakat mexanikasi', notes: 'Tezlik, tezlanish, kuch va massa orasidagi bog‘lanish: F = m * a.' },
  ],
  chemistry: [
    { url: 'https://www.youtube.com/watch?v=FSyAehMdpyI', topic: 'Atom tuzilishi va davriy jadval', notes: 'Kimyoviy elementlar, valentlik va oddiy reaksiya tenglamalarini tenglashtirish.' },
  ],
  biology: [
    { url: 'https://www.youtube.com/watch?v=URUJD5NEXC8', topic: 'Hujayra tuzilishi va fotosintez', notes: 'O‘simlik va hayvon hujayrasining asosiy organoidlari hamda moddalar almashinuvi.' },
  ],
  history: [
    { url: 'https://www.youtube.com/watch?v=Yocja_N5s1I', topic: 'Markaziy Osiyo sivilizatsiyasi va Buyuk Ipak yo‘li', notes: 'Tarixiy shaharlar, madaniy meros va davlatchilik taraqqiyoti.' },
  ],
  geography: [
    { url: 'https://www.youtube.com/watch?v=3n5vX8cR4mA', topic: 'Materiklar, iqlim mintaqalari va xaritalar', notes: 'Geografik koordinatalar, relyef shakllari va O‘zbekiston tabiati.' },
  ],
  informatics: [
    { url: 'https://www.youtube.com/watch?v=FCMxA3m_Imc', topic: 'Algoritmlar, mantiq va dasturlash asoslari', notes: 'Blok-sxemalar, shart operatorlari, sikllar va xavfsiz raqamli savodxonlik.' },
  ],
  law: [
    { url: 'https://www.youtube.com/watch?v=bO7FQsCcbD8', topic: 'Konstitutsiya va fuqarolik huquqlari', notes: 'Inson huquqlari, qonun ustuvorligi va yoshlarning huquqiy maqomi.' },
  ],
  tarbiya: [
    { url: 'https://www.youtube.com/watch?v=arj7oStGLkU', topic: 'Odob-axloq, mas’uliyat va vaqtni boshqarish', notes: 'Jamoada hurmat, halollik va maqsad sari intilish madaniyati.' },
  ],
};

function createMathQuestionSet(grade: number, topic: string): TestQuestion[] {
  const qs: TestQuestion[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i + 2) * (grade <= 4 ? 2 : grade);
    const b = i + 3 + (grade % 5);
    const variant = i % 4;
    if (variant === 0) {
      const ans = a + b;
      qs.push({
        id: `q-${grade}-math-${i + 1}`,
        question: `${i + 1}. (${topic}) ${a} + ${b} yig‘indisi nechaga teng?`,
        options: [String(ans), String(ans + 2), String(ans - 3), String(ans + 5)],
        correctIndex: 0,
        explanation: `${a} + ${b} = ${ans}. Birlik va o‘nlik xonalarni qo‘shish orqali topiladi.`,
      });
    } else if (variant === 1) {
      const x = i + 4;
      const right = x * 3 + grade;
      qs.push({
        id: `q-${grade}-math-${i + 1}`,
        question: `${i + 1}. (${topic}) 3x + ${grade} = ${right} tenglamani yeching.`,
        options: [String(x - 1), String(x), String(x + 2), String(x + 4)],
        correctIndex: 1,
        explanation: `3x = ${right} - ${grade} = ${x * 3}, demak x = ${x}.`,
      });
    } else if (variant === 2) {
      const ans = a * 2 - b;
      qs.push({
        id: `q-${grade}-math-${i + 1}`,
        question: `${i + 1}. (${topic}) 2 · ${a} − ${b} ifodaning qiymatini toping.`,
        options: [String(ans - 4), String(ans + 3), String(ans), String(ans + 7)],
        correctIndex: 2,
        explanation: `Avval ko‘paytirish: 2 · ${a} = ${a * 2}, so‘ngra ${a * 2} − ${b} = ${ans}.`,
      });
    } else {
      const side = (i % 7) + 4;
      const perim = side * 4;
      qs.push({
        id: `q-${grade}-math-${i + 1}`,
        question: `${i + 1}. (${topic}) Tomoni ${side} sm bo‘lgan kvadratning perimetrini toping.`,
        options: [`${perim - 4} sm`, `${perim + 4} sm`, `${side * side} sm`, `${perim} sm`],
        correctIndex: 3,
        explanation: `Kvadratning 4 ta teng tomoni bor: P = 4 · ${side} = ${perim} sm.`,
      });
    }
  }
  return qs;
}

function createSubjectQuestionSet(
  subjectId: string,
  subjectName: string,
  grade: number
): TestQuestion[] {
  if (subjectId === 'math') return createMathQuestionSet(grade, `${grade}-sinf Matematika`);

  const bank: Record<string, { q: string; opts: [string, string, string, string]; c: 0 | 1 | 2 | 3; exp: string }[]> = {
    informatics: [
      { q: 'Algoritm nima?', opts: ['Muammoni yechish uchun aniq ketma-ket buyruqlar', 'Faqat kompyuter ekrani', 'Internet kabeli', 'Matn muharriri'], c: 0, exp: 'Algoritm — qo‘yilgan masalani yechishga qaratilgan aniq qadamlar ketma-ketligi.' },
      { q: '1 bayt necha bitdan iborat?', opts: ['4 bit', '8 bit', '16 bit', '1024 bit'], c: 1, exp: 'Axborot o‘lchov birligida 1 bayt = 8 bit.' },
      { q: 'Ikkilik sanoq tizimida qaysi raqamlar ishlatiladi?', opts: ['1 va 2', '0 dan 9 gacha', '0 va 1', 'A dan F gacha'], c: 2, exp: 'Ikkilik (binary) tizim faqat 0 va 1 raqamlaridan tashkil topgan.' },
      { q: 'CPU qaysi vazifani bajaradi?', opts: ['Fayllarni chop etadi', 'Ma’lumotlarni qayta ishlaydi va hisoblaydi', 'Faqat ovoz chiqaradi', 'Ekran yorug‘ligini o‘lchaydi'], c: 1, exp: 'Markaziy protsessor (CPU) barcha mantiqiy va arifmetik amallarni bajaradi.' },
      { q: 'HTML nima uchun ishlatiladi?', opts: ['Veb-sahifalar tuzilmasini yaratish uchun', 'Operatsion tizim o‘rnatish uchun', 'Printer ulash uchun', 'Video montaj uchun'], c: 0, exp: 'HTML (HyperText Markup Language) veb-sahifalar tuzilmasini belgilaydi.' },
    ],
    english: [
      { q: 'Choose the correct form: "She ___ to school every day."', opts: ['go', 'goes', 'going', 'gone'], c: 1, exp: 'Third-person singular (she/he/it) in Present Simple takes -es: goes.' },
      { q: 'What is the opposite of "ancient"?', opts: ['old', 'modern', 'large', 'quiet'], c: 1, exp: '"Ancient" means very old; its antonym is "modern".' },
      { q: 'Choose the plural of "child":', opts: ['childs', 'childes', 'children', 'childrens'], c: 2, exp: '"Child" has an irregular plural form: "children".' },
      { q: '"Library" so‘zining ma’nosi nima?', opts: ['Oshxona', 'Kutubxona', 'Sport zali', 'Maktab hovlisi'], c: 1, exp: 'Library — kutubxona.' },
      { q: 'Complete: "We ___ a test yesterday."', opts: ['write', 'writes', 'wrote', 'writing'], c: 2, exp: '"Yesterday" indicates Past Simple, so the past form "wrote" is used.' },
    ],
    native_lang: [
      { q: 'O‘zbek tilida nechta unli tovush bor?', opts: ['5 ta', '6 ta', '8 ta', '23 ta'], c: 1, exp: 'Hozirgi o‘zbek adabiy tilida 6 ta unli tovush mavjud: a, o, i, e, u, o‘.' },
      { q: 'Qaysi so‘z turkumi predmetning belgisini bildiradi?', opts: ['Ot', 'Sifat', 'Fe’l', 'Olmosh'], c: 1, exp: 'Sifat predmetning rangi, shakli, mazasi kabi belgisini bildiradi.' },
      { q: 'Gapning bosh bo‘laklari qaysilar?', opts: ['To‘ldiruvchi va hol', 'Aniqlovchi va undalma', 'Ega va kesim', 'Kirish so‘z'], c: 2, exp: 'Ega va kesim gapning asosini tashkil qiluvchi bosh bo‘laklardir.' },
      { q: 'Qaysi so‘z to‘g‘ri yozilgan?', opts: ['maxsus', 'mahsus', 'makhsus', 'maqsus'], c: 0, exp: 'Adabiy imlo qoidasiga ko‘ra "maxsus" shaklida yoziladi.' },
      { q: '"Kitobxon" so‘zining o‘zagi qaysi?', opts: ['xon', 'kitob', 'ki', 'ob'], c: 1, exp: 'So‘zning asosiy ma’no anglatuvchi qismi — "kitob".' },
    ],
    physics: [
      { q: 'Xalqaro birliklar tizimida (SI) kuch birligi nima?', opts: ['Joul (J)', 'Nyuton (N)', 'Vatt (W)', 'Paskal (Pa)'], c: 1, exp: 'Kuch SI tizimida Nyuton (N) bilan o‘lchanadi.' },
      { q: 'Tekis harakatda tezlik formulasi qaysi?', opts: ['v = s / t', 'v = m · a', 'v = F · s', 'v = t / s'], c: 0, exp: 'Tezlik bosib o‘tilgan yo‘lning vaqtga nisbatiga teng: v = s / t.' },
      { q: 'Nyutonning ikkinchi qonuni qaysi formula bilan ifodalanadi?', opts: ['E = mc²', 'F = m · a', 'P = U · I', 'p = m · v'], c: 1, exp: 'Jismga ta’sir etuvchi kuch massa va tezlanish ko‘paytmasiga teng: F = m · a.' },
      { q: 'Suvning normal atmosfera bosimidagi qaynash harorati?', opts: ['50 °C', '80 °C', '100 °C', '120 °C'], c: 2, exp: 'Normal bosimda toza suv 100 °C da qaynaydi.' },
      { q: 'Elektr tokining o‘lchov birligi qaysi?', opts: ['Volt', 'Om', 'Amper', 'Kulon'], c: 2, exp: 'Tok kuchi Amper (A) da o‘lchanadi.' },
    ],
  };

  const baseList = bank[subjectId] || [
    { q: `${subjectName} fanining asosiy o‘rganish obyekti nima?`, opts: ['Mavzuga oid qonuniyatlar va amaliy ko‘nikmalar', 'Faqat raqamlar yig‘indisi', 'Tasodifiy ma’lumotlar', 'Hech biri'], c: 0 as const, exp: `${subjectName} fani tizimli bilim va amaliy tahlil ko‘nikmalarini shakllantiradi.` },
    { q: `${grade}-sinf ${subjectName} darsida nazariya va amaliyot qanday bog‘lanadi?`, opts: ['Nazariya mashqlar bilan mustahkamlanadi', 'Ular bog‘lanmaydi', 'Faqat yodlash yetarli', 'Sinov o‘tkazilmaydi'], c: 0 as const, exp: 'Nazariy qoidalarni amaliy misollar bilan mustahkamlash eng samarali usuldir.' },
    { q: `Mavzuni chuqur o‘zlashtirish uchun qaysi qadam muhim?`, opts: ['Matnni tahlil qilish va xulosa chiqarish', 'Mavzuni o‘tkazib yuborish', 'Savol bermaslik', 'Faqat sarlavhani o‘qish'], c: 0 as const, exp: 'Tahlil qilish va mustaqil misol yechish bilimlarni mustahkamlaydi.' },
    { q: `${subjectName} bo‘yicha topshiriq bajarilganda nimaga e’tibor beriladi?`, opts: ['Aniqlik, mantiqiy izchillik va dalillar', 'Faqat tezlikka', 'Matn uzunligiga', 'Shrift rangiga'], c: 0 as const, exp: 'Har bir javob mantiqiy asoslangan va aniq bo‘lishi zarur.' },
  ];

  const questions: TestQuestion[] = [];
  for (let i = 0; i < 20; i++) {
    const item = baseList[i % baseList.length];
    questions.push({
      id: `q-${grade}-${subjectId}-${i + 1}`,
      question: `${i + 1}. [${grade}-sinf · ${subjectName}] ${item.q}`,
      options: item.opts,
      correctIndex: item.c,
      explanation: item.exp,
    });
  }
  return questions;
}

export function createSeedUsers(): StoredUser[] {
  const now = new Date();
  const plus30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  const minus5 = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString();

  return [
    {
      id: 'user-admin-1',
      role: 'admin',
      firstName: 'Dilshod',
      lastName: 'Raximov',
      phone: '+998901000001',
      email: 'admin@348maktab.uz',
      approved: true,
      faceVerified: true,
      passwordHash: hashPassword('admin348'),
      createdAt: now.toISOString(),
    },
    {
      id: 'user-teacher-1',
      role: 'teacher',
      firstName: 'Malika',
      lastName: 'Rustamova',
      phone: '+998902000001',
      email: 'malika.rustamova@gmail.com',
      assignedGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      assignedSubjects: ['math', 'informatics', 'physics'],
      approved: true,
      faceVerified: true,
      passwordHash: hashPassword('teacher348'),
      createdAt: now.toISOString(),
    },
    {
      id: 'user-teacher-2',
      role: 'teacher',
      firstName: 'Jasur',
      lastName: 'Karimov',
      phone: '+998902000002',
      email: 'jasur.karimov@gmail.com',
      assignedGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      assignedSubjects: ['native_lang', 'literature', 'english', 'russian', 'history'],
      approved: true,
      faceVerified: true,
      passwordHash: hashPassword('teacher348'),
      createdAt: now.toISOString(),
    },
    {
      id: 'user-student-3',
      role: 'student',
      firstName: 'Madina',
      lastName: 'Olimova',
      phone: '+998903000003',
      parentPhone: '+998903009903',
      grade: 3,
      approved: true,
      subscriptionExpiresAt: plus30,
      stars: 145,
      medals: ['Matematika yulduzi', 'Faol kitobxon', '100% test ustasi'],
      passwordHash: hashPassword('student348'),
      createdAt: now.toISOString(),
    },
    {
      id: 'user-student-9',
      role: 'student',
      firstName: 'Sardorbek',
      lastName: 'Alimov',
      phone: '+998903000009',
      parentPhone: '+998903009909',
      grade: 9,
      approved: true,
      subscriptionExpiresAt: plus30,
      stars: 210,
      medals: ['Informatika yetakchisi'],
      passwordHash: hashPassword('student348'),
      createdAt: now.toISOString(),
    },
    {
      id: 'user-student-8',
      role: 'student',
      firstName: 'Azizbek',
      lastName: 'Tursunov',
      phone: '+998903000008',
      parentPhone: '+998903009908',
      grade: 8,
      approved: true,
      subscriptionExpiresAt: minus5, // expired to demonstrate payment gate
      stars: 60,
      medals: [],
      passwordHash: hashPassword('student348'),
      createdAt: now.toISOString(),
    },
  ];
}

export function createSeedVideos(): VideoLesson[] {
  const lessons: VideoLesson[] = [];
  const now = new Date().toISOString();

  for (let grade = 1; grade <= 11; grade++) {
    for (const subject of SCHOOL_SUBJECTS) {
      if (grade < subject.minGrade || grade > subject.maxGrade) continue;
      const pool = VIDEO_POOL[subject.id] || VIDEO_POOL.math;
      const item = pool[(grade - 1) % pool.length];
      lessons.push({
        id: `vid-${grade}-${subject.id}`,
        title: `${grade}-sinf · ${subject.nameUz}: ${item.topic}`,
        subjectId: subject.id,
        grade,
        topic: item.topic,
        durationMinutes: 12 + (grade % 8),
        videoUrl: item.url,
        notes: `${grade}-sinf o‘quv dasturi asosida tayyorlangan video dars. ${item.notes}`,
        teacherName: ['math', 'informatics', 'physics'].includes(subject.id)
          ? 'Malika Rustamova'
          : 'Jasur Karimov',
        createdAt: now,
      });
    }
  }
  return lessons;
}

export function createSeedEbooks(): Ebook[] {
  const books: Ebook[] = [];
  const now = new Date().toISOString();

  for (let grade = 1; grade <= 11; grade++) {
    const gradeSubjects = SCHOOL_SUBJECTS.filter(
      (s) =>
        grade >= s.minGrade &&
        grade <= s.maxGrade &&
        ['math', 'native_lang', 'english', 'informatics', 'physics', 'biology'].includes(s.id)
    );
    for (const subj of gradeSubjects) {
      const id = `ebook-${grade}-${subj.id}`;
      books.push({
        id,
        title: `${subj.nameUz} (${grade}-sinf darsligi)`,
        subjectId: subj.id,
        grade,
        author: '348-MAKTAB Metodik Kengashi',
        pagesCount: 120 + grade * 8,
        summary: `${grade}-sinf o‘quvchilari uchun ${subj.nameUz.toLowerCase()} fanidan nazariy qoidalar, namunaviy masalalar va mashqlar to‘plami.`,
        chapters: [
          {
            title: `Asosiy tushunchalar va kirish (${grade}-sinf)`,
            content: `${grade}-sinf ${subj.nameUz} kursining birinchi bobida asosiy atamalar, qoidalar va kundalik hayotdagi qo‘llanilishi ko‘rib chiqiladi.\n\nHar bir mavzu bo‘yicha bosqichma-bosqich misollar keltirilgan bo‘lib, dars oxiridagi savollar o‘zlashtirish darajasini tekshirishga yordam beradi.`,
          },
          {
            title: `Amaliy mashqlar va yechim usullari`,
            content: `Ushbu bobda ${subj.nameUz.toLowerCase()} fanidan tipik masalalarni tez va bexato yechish usullari ko‘rsatilgan.\n\n1-qoida: Shartni diqqat bilan o‘qib, berilgan kattaliklarni ajratib oling.\n2-qoida: Tegishli formula yoki qoidani qo‘llab, natijani tekshiring.`,
          },
          {
            title: `Takrorlash va nazorat savollari`,
            content: `Bo‘lim yakunida 20 savollik testga tayyorlanish uchun asosiy formulalar va qisqa konspekt jamlangan.\n\nUy vazifalarini o‘z vaqtida topshirish orqali bilimingizni mustahkamlang.`,
          },
        ],
        pdfUrl: `/api/ebooks/${id}/pdf`,
        createdAt: now,
      });
    }
  }
  return books;
}

export function createSeedHomeworks(): HomeworkAssignment[] {
  const now = Date.now();
  const in3Days = new Date(now + 3 * 24 * 3600 * 1000).toISOString();
  const in5Days = new Date(now + 5 * 24 * 3600 * 1000).toISOString();
  const yesterday = new Date(now - 24 * 3600 * 1000).toISOString();

  return [
    {
      id: 'hw-3-math-1',
      title: 'Ko‘paytirish jadvali va matnli masalalar',
      grade: 3,
      subjectId: 'math',
      topic: '2, 3, 4 va 5 ga ko‘paytirish',
      deadline: in3Days,
      description: 'Darslikdagi 14–18-misollarni daftarga yeching, javobingizni yozing yoki daftaringiz rasmini yuklang.',
      helpVideoUrl: 'https://www.youtube.com/watch?v=NybHckSEQBI',
      helpPdfUrl: '/api/ebooks/ebook-3-math/pdf',
      helpExplanation: 'Matnli masalalarda avval "nechta bor edi" va "necha marta ortdi" so‘zlariga e’tibor bering. Ko‘paytirish — bir xil qo‘shiluvchilarning qisqa yozuvi!',
      teacherId: 'user-teacher-1',
      teacherName: 'Malika Rustamova',
      createdAt: new Date(now - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'hw-3-english-1',
      title: 'My Daily Routine — 5 ta gap tuzish',
      grade: 3,
      subjectId: 'english',
      topic: 'Present Simple kundalik harakatlar',
      deadline: in5Days,
      description: 'Ingliz tilida ertalabdan kechgacha qiladigan 5 ta ishingiz haqida sodda gaplar yozing.',
      helpVideoUrl: 'https://www.youtube.com/watch?v=jul2HYFDgGk',
      helpPdfUrl: '/api/ebooks/ebook-3-english/pdf',
      helpExplanation: 'Masalan: "I wake up at 7 o‘clock. I go to school at 8 o‘clock." Gaplarda I + fe’l shaklini ishlating.',
      teacherId: 'user-teacher-2',
      teacherName: 'Jasur Karimov',
      createdAt: new Date(now - 1 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'hw-9-math-1',
      title: 'Kvadrat tenglamalar va Vieta teoremasi',
      grade: 9,
      subjectId: 'math',
      topic: 'ax² + bx + c = 0 tenglamalar',
      deadline: in3Days,
      description: 'x² − 7x + 12 = 0 va 2x² − 5x − 3 = 0 tenglamalarni diskriminant hamda Vieta teoremasi yordamida yeching.',
      helpVideoUrl: 'https://www.youtube.com/watch?v=Kp2bYWRQylk',
      helpPdfUrl: '/api/ebooks/ebook-9-math/pdf',
      helpExplanation: 'Diskriminant D = b² − 4ac. Agar D > 0 bo‘lsa, x₁,₂ = (-b ± √D) / (2a). Keltirilgan kvadrat tenglamada x₁ + x₂ = -p va x₁ · x₂ = q.',
      teacherId: 'user-teacher-1',
      teacherName: 'Malika Rustamova',
      createdAt: new Date(now - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'hw-9-inf-1',
      title: 'Algoritm blok-sxemasi va Python sikllari',
      grade: 9,
      subjectId: 'informatics',
      topic: 'for va while sikllari',
      deadline: yesterday, // overdue assignment for SMS scheduler demo
      description: '1 dan 100 gacha bo‘lgan juft sonlar yig‘indisini hisoblovchi dastur kodini va izohini topshiring.',
      helpVideoUrl: 'https://www.youtube.com/watch?v=FCMxA3m_Imc',
      helpPdfUrl: '/api/ebooks/ebook-9-informatics/pdf',
      helpExplanation: 'Python tilida range(2, 101, 2) orqali barcha juft sonlarni aylanib, sum() yoki yig‘indi o‘zgaruvchisida jamlash mumkin.',
      teacherId: 'user-teacher-1',
      teacherName: 'Malika Rustamova',
      createdAt: new Date(now - 4 * 24 * 3600 * 1000).toISOString(),
    },
  ];
}

export function createSeedSubmissions(): HomeworkSubmission[] {
  const now = Date.now();
  return [
    {
      id: 'sub-3-math-1',
      homeworkId: 'hw-3-math-1',
      studentId: 'user-student-3',
      studentName: 'Madina Olimova',
      grade: 3,
      subjectId: 'math',
      topic: '2, 3, 4 va 5 ga ko‘paytirish',
      answerText: '14) 3 × 4 = 12; 15) 5 × 6 = 30; 16) 4 × 7 = 28; Masala javobi: 24 ta olma.',
      status: 'approved',
      score: 96,
      mark5: 5,
      teacherComment: 'Barakalla, Madina! Barcha misollar to‘g‘ri va chiroyli bajarilgan.',
      submittedAt: new Date(now - 36 * 3600 * 1000).toISOString(),
      reviewedAt: new Date(now - 12 * 3600 * 1000).toISOString(),
      reviewedBy: 'Malika Rustamova',
    },
    {
      id: 'sub-9-math-1',
      homeworkId: 'hw-9-math-1',
      studentId: 'user-student-9',
      studentName: 'Sardorbek Alimov',
      grade: 9,
      subjectId: 'math',
      topic: 'ax² + bx + c = 0 tenglamalar',
      answerText: '1) x² - 7x + 12 = 0 -> x₁ = 3, x₂ = 4. 2) 2x² - 5x - 3 = 0 -> D = 49, x₁ = 3, x₂ = -0.5.',
      status: 'pending',
      submittedAt: new Date(now - 5 * 3600 * 1000).toISOString(),
    },
  ];
}

export function createSeedTests(): SchoolTest[] {
  const now = new Date().toISOString();
  const tests: SchoolTest[] = [
    {
      id: 'test-3-math',
      title: '3-sinf Matematika: Ko‘paytirish va masalalar (20 savol)',
      grade: 3,
      subjectId: 'math',
      durationMinutes: 25,
      questions: createSubjectQuestionSet('math', 'Matematika', 3),
      teacherId: 'user-teacher-1',
      createdAt: now,
    },
    {
      id: 'test-3-english',
      title: '3-sinf Ingliz tili: Asosiy grammatika (20 savol)',
      grade: 3,
      subjectId: 'english',
      durationMinutes: 20,
      questions: createSubjectQuestionSet('english', 'Ingliz tili', 3),
      teacherId: 'user-teacher-2',
      createdAt: now,
    },
    {
      id: 'test-9-math',
      title: '9-sinf Algebra: Tenglamalar va funksiyalar (20 savol)',
      grade: 9,
      subjectId: 'math',
      durationMinutes: 30,
      questions: createSubjectQuestionSet('math', 'Matematika', 9),
      teacherId: 'user-teacher-1',
      createdAt: now,
    },
    {
      id: 'test-9-informatics',
      title: '9-sinf Informatika: Algoritmlar va dasturlash (20 savol)',
      grade: 9,
      subjectId: 'informatics',
      durationMinutes: 25,
      questions: createSubjectQuestionSet('informatics', 'Informatika', 9),
      teacherId: 'user-teacher-1',
      createdAt: now,
    },
    {
      id: 'test-9-physics',
      title: '9-sinf Fizika: Mexanika va elektr (20 savol)',
      grade: 9,
      subjectId: 'physics',
      durationMinutes: 25,
      questions: createSubjectQuestionSet('physics', 'Fizika', 9),
      teacherId: 'user-teacher-1',
      createdAt: now,
    },
  ];

  // Ensure every grade 1-11 has at least Math & Native Language 20-question tests
  for (let g = 1; g <= 11; g++) {
    if (!tests.some((t) => t.grade === g && t.subjectId === 'math')) {
      tests.push({
        id: `test-${g}-math`,
        title: `${g}-sinf Matematika: Nazorat testi (20 savol)`,
        grade: g,
        subjectId: 'math',
        durationMinutes: 25,
        questions: createSubjectQuestionSet('math', 'Matematika', g),
        teacherId: 'user-teacher-1',
        createdAt: now,
      });
    }
    if (!tests.some((t) => t.grade === g && t.subjectId === 'native_lang')) {
      tests.push({
        id: `test-${g}-native_lang`,
        title: `${g}-sinf Ona tili: Imlo va grammatika (20 savol)`,
        grade: g,
        subjectId: 'native_lang',
        durationMinutes: 20,
        questions: createSubjectQuestionSet('native_lang', 'Ona tili', g),
        teacherId: 'user-teacher-2',
        createdAt: now,
      });
    }
  }
  return tests;
}

export function createSeedTestResults(): TestAttemptResult[] {
  const now = Date.now();
  return [
    {
      id: 'res-seed-1',
      testId: 'test-3-math',
      testTitle: '3-sinf Matematika: Ko‘paytirish va masalalar (20 savol)',
      studentId: 'user-student-3',
      studentName: 'Madina Olimova',
      grade: 3,
      subjectId: 'math',
      correctCount: 18,
      wrongCount: 2,
      totalQuestions: 20,
      percentage: 90,
      score: 90,
      answers: Array(20).fill(0),
      submittedAt: new Date(now - 20 * 3600 * 1000).toISOString(),
    },
    {
      id: 'res-seed-2',
      testId: 'test-9-math',
      testTitle: '9-sinf Algebra: Tenglamalar va funksiyalar (20 savol)',
      studentId: 'user-student-9',
      studentName: 'Sardorbek Alimov',
      grade: 9,
      subjectId: 'math',
      correctCount: 17,
      wrongCount: 3,
      totalQuestions: 20,
      percentage: 85,
      score: 85,
      answers: Array(20).fill(0),
      submittedAt: new Date(now - 15 * 3600 * 1000).toISOString(),
    },
  ];
}

export function createSeedNotifications(): NotificationItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'notif-1',
      userId: 'user-student-3',
      title: 'Uy vazifasi tasdiqlandi ✓',
      message: 'Malika Rustamova "Ko‘paytirish jadvali" vazifangizni 5 (96%) baho bilan qabul qildi.',
      type: 'success',
      read: false,
      createdAt: now,
    },
    {
      id: 'notif-2',
      userId: 'user-student-9',
      title: 'Eslatma: Informatika vazifasi',
      message: '"Algoritm blok-sxemasi" vazifasini topshirish muddati yaqinlashdi yoki o‘tdi.',
      type: 'warning',
      read: false,
      createdAt: now,
    },
    {
      id: 'notif-3',
      userId: 'user-teacher-1',
      title: 'Yangi vazifa topshirildi',
      message: '9-sinf o‘quvchisi Sardorbek Alimov "Kvadrat tenglamalar" vazifasini yubordi.',
      type: 'info',
      read: false,
      createdAt: now,
    },
  ];
}

interface LangTemplate {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nativeName: string;
  speechLang: string;
  code: string;
  videoUrl: string;
  words: { w: string; ph: string; uz: string; ru: string; en: string; ex: string }[];
}

const LANG_TEMPLATES: LangTemplate[] = [
  {
    id: 'english', nameUz: 'Ingliz tili', nameRu: 'Английский язык', nameEn: 'English', nativeName: 'English', speechLang: 'en-US', code: 'EN',
    videoUrl: 'https://www.youtube.com/watch?v=jul2HYFDgGk',
    words: [
      { w: 'Knowledge', ph: '/ˈnɒl.ɪdʒ/', uz: 'Bilim', ru: 'Знание', en: 'Knowledge', ex: 'Knowledge opens every door.' },
      { w: 'Schedule', ph: '/ˈʃed.juːl/', uz: 'Jadval', ru: 'Расписание', en: 'Schedule', ex: 'Check your daily school schedule.' },
      { w: 'Improve', ph: '/ɪmˈpruːv/', uz: 'Yaxshilamoq', ru: 'Улучшать', en: 'Improve', ex: 'Practice helps you improve rapidly.' },
      { w: 'Achieve', ph: '/əˈtʃiːv/', uz: 'Erishmoq', ru: 'Достигать', en: 'Achieve', ex: 'Set clear goals and achieve them.' },
      { w: 'Fluency', ph: '/ˈfluː.ən.si/', uz: 'Ravonlik', ru: 'Беглость', en: 'Fluency', ex: 'Daily speaking builds fluency.' },
    ],
  },
  {
    id: 'russian', nameUz: 'Rus tili', nameRu: 'Русский язык', nameEn: 'Russian', nativeName: 'Русский', speechLang: 'ru-RU', code: 'RU',
    videoUrl: 'https://www.youtube.com/watch?v=4xK6J3iE6wI',
    words: [
      { w: 'Образование', ph: '[abrazavániye]', uz: 'Ta’lim', ru: 'Образование', en: 'Education', ex: 'Образование — ключ к будущему.' },
      { w: 'Успех', ph: '[uspékh]', uz: 'Muvaffaqiyat', ru: 'Успех', en: 'Success', ex: 'Труд приводит к успеху.' },
      { w: 'Учебник', ph: '[uchébnik]', uz: 'Darslik', ru: 'Учебник', en: 'Textbook', ex: 'Откройте учебник на десятой странице.' },
      { w: 'Расписание', ph: '[raspisániye]', uz: 'Dars jadvali', ru: 'Расписание', en: 'Timetable', ex: 'Посмотрите новое расписание уроков.' },
      { w: 'Внимание', ph: '[vnimániye]', uz: 'Diqqat', ru: 'Внимание', en: 'Attention', ex: 'Обратите внимание на произношение.' },
    ],
  },
  {
    id: 'german', nameUz: 'Nemis tili', nameRu: 'Немецкий язык', nameEn: 'German', nativeName: 'Deutsch', speechLang: 'de-DE', code: 'DE',
    videoUrl: 'https://www.youtube.com/watch?v=RuGmc662HDg',
    words: [
      { w: 'Bildung', ph: '/ˈbɪldʊŋ/', uz: 'Ta’lim', ru: 'Образование', en: 'Education', ex: 'Bildung ist sehr wichtig.' },
      { w: 'Schule', ph: '/ˈʃuːlə/', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'Wir lernen in der Schule.' },
      { w: 'Wissenschaft', ph: '/ˈvɪsn̩ʃaft/', uz: 'Ilm-fan', ru: 'Наука', en: 'Science', ex: 'Wissenschaft erklärt die Welt.' },
      { w: 'Verstehen', ph: '/fɛɐ̯ˈʃteːən/', uz: 'Tushunmoq', ru: 'Понимать', en: 'Understand', ex: 'Ich verstehe die Grammatik.' },
      { w: 'Zukunft', ph: '/ˈt͡suːkʊnft/', uz: 'Kelajak', ru: 'Будущее', en: 'Future', ex: 'Sprachen öffnen die Zukunft.' },
    ],
  },
  {
    id: 'french', nameUz: 'Fransuz tili', nameRu: 'Французский язык', nameEn: 'French', nativeName: 'Français', speechLang: 'fr-FR', code: 'FR',
    videoUrl: 'https://www.youtube.com/watch?v=8nR0sT2dL1Q',
    words: [
      { w: 'École', ph: '/e.kɔl/', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'Mon école est moderne.' },
      { w: 'Savoir', ph: '/sa.vwaʁ/', uz: 'Bilim / Bilmoq', ru: 'Знание', en: 'Knowledge', ex: 'Le savoir est une force.' },
      { w: 'Parler', ph: '/paʁ.le/', uz: 'Gaplashmoq', ru: 'Говорить', en: 'To speak', ex: 'Nous aimons parler français.' },
      { w: 'Livre', ph: '/livʁ/', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: 'Je lis un bon livre.' },
      { w: 'Réussite', ph: '/ʁe.y.sit/', uz: 'Muvaffaqiyat', ru: 'Успех', en: 'Success', ex: 'La persévérance mène à la réussite.' },
    ],
  },
  {
    id: 'spanish', nameUz: 'Ispan tili', nameRu: 'Испанский язык', nameEn: 'Spanish', nativeName: 'Español', speechLang: 'es-ES', code: 'ES',
    videoUrl: 'https://www.youtube.com/watch?v=6_5FnCzkObA',
    words: [
      { w: 'Aprender', ph: '/apɾenˈdeɾ/', uz: 'O‘rganmoq', ru: 'Учиться', en: 'To learn', ex: 'Quiero aprender español.' },
      { w: 'Biblioteca', ph: '/biβljoˈteka/', uz: 'Kutubxona', ru: 'Библиотека', en: 'Library', ex: 'Estudio en la biblioteca.' },
      { w: 'Maestro', ph: '/maˈestɾo/', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: 'El maestro explica la lección.' },
      { w: 'Palabra', ph: '/paˈlaβɾa/', uz: 'So‘z', ru: 'Слово', en: 'Word', ex: 'Cada palabra nueva ayuda.' },
      { w: 'Éxito', ph: '/ˈeksito/', uz: 'Yutuq', ru: 'Успех', en: 'Success', ex: 'Tu esfuerzo trae éxito.' },
    ],
  },
  {
    id: 'arabic', nameUz: 'Arab tili', nameRu: 'Арабский язык', nameEn: 'Arabic', nativeName: 'العربية', speechLang: 'ar-SA', code: 'AR',
    videoUrl: 'https://www.youtube.com/watch?v=X1mC1225k6k',
    words: [
      { w: 'عِلْم (Ilm)', ph: '[ilm]', uz: 'Ilm', ru: 'Знание', en: 'Knowledge', ex: 'العلم نور — Ilm nurdir.' },
      { w: 'مَدْرَسَة (Madrasa)', ph: '[madrasa]', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'أذهب إلى المدرسة — Maktabga boraman.' },
      { w: 'كِتَاب (Kitob)', ph: '[kitāb]', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: 'هذا كتاب مفيد — Bu foydali kitob.' },
      { w: 'مُعَلِّم (Muallim)', ph: '[muʿallim]', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: 'المعلم يشرح الدرس.' },
      { w: 'قَلَم (Qalam)', ph: '[qalam]', uz: 'Qalam', ru: 'Ручка', en: 'Pen', ex: 'أكتب بالقلم.' },
    ],
  },
  {
    id: 'chinese', nameUz: 'Xitoy tili', nameRu: 'Китайский язык', nameEn: 'Chinese', nativeName: '中文', speechLang: 'zh-CN', code: 'ZH',
    videoUrl: 'https://www.youtube.com/watch?v=McZW0iQOPEA',
    words: [
      { w: '学习 (Xuéxí)', ph: '[xuéxí]', uz: 'O‘rganmoq', ru: 'Учиться', en: 'Study', ex: '我喜欢学习汉语。' },
      { w: '学校 (Xuéxiào)', ph: '[xuéxiào]', uz: 'Maktab', ru: 'Школа', en: 'School', ex: '我们的学校很大。' },
      { w: '老师 (Lǎoshī)', ph: '[lǎoshī]', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: '老师讲得很清楚。' },
      { w: '书本 (Shūběn)', ph: '[shūběn]', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: '请打开书本。' },
      { w: '朋友 (Péngyou)', ph: '[péngyou]', uz: 'Do‘st', ru: 'Друг', en: 'Friend', ex: '我们是好朋友。' },
    ],
  },
  {
    id: 'korean', nameUz: 'Koreys tili', nameRu: 'Корейский язык', nameEn: 'Korean', nativeName: '한국어', speechLang: 'ko-KR', code: 'KO',
    videoUrl: 'https://www.youtube.com/watch?v=0ZhOeA0RD9o',
    words: [
      { w: '학교 (Hakgyo)', ph: '[hak-gyo]', uz: 'Maktab', ru: 'Школа', en: 'School', ex: '저는 학교에 갑니다.' },
      { w: '선생님 (Seonsaengnim)', ph: '[seon-saeng-nim]', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: '선생님, 감사합니다.' },
      { w: '공부 (Gongbu)', ph: '[gong-bu]', uz: 'O‘qish / Dars', ru: 'Учёба', en: 'Study', ex: '매일 한국어를 공부해요.' },
      { w: '책 (Chaek)', ph: '[chaek]', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: '이 책이 재미있어요.' },
      { w: '미래 (Mirae)', ph: '[mi-rae]', uz: 'Kelajak', ru: 'Будущее', en: 'Future', ex: '밝은 미래를 준비해요.' },
    ],
  },
  {
    id: 'japanese', nameUz: 'Yapon tili', nameRu: 'Японский язык', nameEn: 'Japanese', nativeName: '日本語', speechLang: 'ja-JP', code: 'JA',
    videoUrl: 'https://www.youtube.com/watch?v=6p9Il_j0zjc',
    words: [
      { w: '学校 (Gakkō)', ph: '[gakkō]', uz: 'Maktab', ru: 'Школа', en: 'School', ex: '学校で勉強します。' },
      { w: '先生 (Sensei)', ph: '[sensei]', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: '先生に質問します。' },
      { w: '勉強 (Benkyō)', ph: '[benkyō]', uz: 'O‘rganish', ru: 'Учёба', en: 'Study', ex: '日本語の勉強が楽しいです。' },
      { w: '本 (Hon)', ph: '[hon]', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: '毎日新しい本を読みます。' },
      { w: '夢 (Yume)', ph: '[yume]', uz: 'Orzu', ru: 'Мечта', en: 'Dream', ex: '大きな夢を持ちましょう。' },
    ],
  },
  {
    id: 'turkish', nameUz: 'Turk tili', nameRu: 'Турецкий язык', nameEn: 'Turkish', nativeName: 'Türkçe', speechLang: 'tr-TR', code: 'TR',
    videoUrl: 'https://www.youtube.com/watch?v=M0n-3j3L4pY',
    words: [
      { w: 'Okul', ph: '/oˈkuɫ/', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'Okulumuzu çok seviyoruz.' },
      { w: 'Öğretmen', ph: '/øːɾetˈmen/', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: 'Öğretmenimiz konuyu anlattı.' },
      { w: 'Bilgi', ph: '/bilˈɟi/', uz: 'Bilim / Ma’lumot', ru: 'Знание', en: 'Knowledge', ex: 'Bilgi paylaştıkça çoğalır.' },
      { w: 'Kitap', ph: '/ciˈtap/', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: 'Her gün kitap okuyorum.' },
      { w: 'Başarı', ph: '/baʃaˈɾɯ/', uz: 'Muvaffaqiyat', ru: 'Успех', en: 'Success', ex: 'Düzenli çalışma başarı getirir.' },
    ],
  },
  {
    id: 'italian', nameUz: 'Italyan tili', nameRu: 'Итальянский язык', nameEn: 'Italian', nativeName: 'Italiano', speechLang: 'it-IT', code: 'IT',
    videoUrl: 'https://www.youtube.com/watch?v=kJ-1B6x8Q8I',
    words: [
      { w: 'Scuola', ph: '/ˈskwɔ.la/', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'Vado a scuola ogni mattina.' },
      { w: 'Imparare', ph: '/im.paˈra.re/', uz: 'O‘rganmoq', ru: 'Учиться', en: 'To learn', ex: 'Mi piace imparare le lingue.' },
      { w: 'Libro', ph: '/ˈli.bro/', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: 'Leggo un libro interessante.' },
      { w: 'Insegnante', ph: '/in.seɲˈɲan.te/', uz: 'O‘qituvchi', ru: 'Учитель', en: 'Teacher', ex: 'L’insegnante aiuta gli studenti.' },
      { w: 'Futuro', ph: '/fuˈtu.ro/', uz: 'Kelajak', ru: 'Будущее', en: 'Future', ex: 'Costruiamo un buon futuro.' },
    ],
  },
  {
    id: 'kazakh', nameUz: 'Qozoq tili', nameRu: 'Казахский язык', nameEn: 'Kazakh', nativeName: 'Қазақ тілі', speechLang: 'kk-KZ', code: 'KK',
    videoUrl: 'https://www.youtube.com/watch?v=zL9k2pW0x3E',
    words: [
      { w: 'Мектеп', ph: '[mek-tep]', uz: 'Maktab', ru: 'Школа', en: 'School', ex: 'Біздің мектеп өте заманауи.' },
      { w: 'Білім', ph: '[bi-lim]', uz: 'Bilim', ru: 'Знание', en: 'Knowledge', ex: 'Білім — ең үлкен байлық.' },
      { w: 'Ұстаз', ph: '[ustaz]', uz: 'Ustoz', ru: 'Учитель', en: 'Teacher', ex: 'Ұстаз шәкіртке бағыт береді.' },
      { w: 'Кітап', ph: '[ki-tap]', uz: 'Kitob', ru: 'Книга', en: 'Book', ex: 'Кітап оқу ойды дамытады.' },
      { w: 'Болашақ', ph: '[bolashak]', uz: 'Kelajak', ru: 'Будущее', en: 'Future', ex: 'Жарқын болашақ білімді жастарда.' },
    ],
  },
];

export function createSeedLanguageCourses(): LanguageCourse[] {
  const levels: LanguageLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
  return LANG_TEMPLATES.map((tpl) => {
    const levelMap = {} as Record<LanguageLevel, LanguageCourse['levels']['Beginner']>;
    for (const lvl of levels) {
      levelMap[lvl] = {
        level: lvl,
        videoUrl: tpl.videoUrl,
        videoTitle: `${tpl.nameUz} (${lvl}) — Asosiy dars va talaffuz`,
        grammarTitle:
          lvl === 'Beginner'
            ? `${tpl.nameUz}: Gap tuzilishi va boshlang‘ich zamonlar`
            : lvl === 'Intermediate'
            ? `${tpl.nameUz}: Murakkab zamonlar va bog‘lovchilar`
            : `${tpl.nameUz}: Akademik uslub va ravon nutq konstruksiyalari`,
        grammarRules: [
          `${lvl} bosqichida ${tpl.nameUz} gap tartibi (Ega + Kesim + To‘ldiruvchi) muntazam mashq qilinadi.`,
          `So‘zlarning talaffuz urg‘usi va kundalik dialoglarda qo‘llanish holatlari o‘rganiladi.`,
          `Har kuni kamida 5 ta yangi so‘zni kontekstli gap tarkibida yodlash tavsiya etiladi.`,
        ],
        vocabulary: tpl.words.map((w) => ({
          word: w.w,
          phonetic: w.ph,
          translationUz: w.uz,
          translationRu: w.ru,
          translationEn: w.en,
          example: w.ex,
        })),
        listeningScript: `${tpl.words[0].ex} ${tpl.words[1].ex} ${tpl.words[2].ex}`,
        listeningQuestion: `Audio matnda qaysi asosiy fikr ta’kidlandi?`,
        listeningOptions: [
          `Bilim va muntazam mashq muvaffaqiyatga olib keladi (${tpl.words[0].uz})`,
          'Hech qanday reja kerak emas',
          'Faqat dam olish haqida gapirildi',
          'Matnda til haqida so‘z yuritilmadi',
        ],
        listeningCorrectIndex: 0,
        speakingPrompt: `Quyidagi namunani ovoz chiqarib talaffuz qiling (${tpl.nativeName}): "${tpl.words[0].ex}"`,
        speakingSample: tpl.words[0].ex,
        readingTitle: `${tpl.nameUz} — ${lvl} o‘qish matni`,
        readingPassage: `${tpl.nativeName} (${tpl.nameUz}) tilini o‘rganish zamonaviy ta’lim va xalqaro muloqot uchun keng imkoniyatlar ochadi. ${tpl.words[0].ex} ${tpl.words[3].ex}`,
        readingQuestion: `Matnga ko‘ra ${tpl.nameUz} o‘rganish nima beradi?`,
        readingOptions: [
          'Zamonaviy ta’lim va xalqaro muloqot imkoniyatlarini ochadi',
          'Faqat uyquni yaxshilaydi',
          'Hech qanday foyda bermaydi',
          'Matnda bu haqda aytilmagan',
        ],
        readingCorrectIndex: 0,
        homeworkPrompt: `${tpl.nameUz} (${lvl}) lug‘atidagi 5 ta so‘z ishtirokida 3 ta mustaqil gap tuzing.`,
      };
    }

    return {
      id: tpl.id,
      nameUz: tpl.nameUz,
      nameRu: tpl.nameRu,
      nameEn: tpl.nameEn,
      nativeName: tpl.nativeName,
      speechLang: tpl.speechLang,
      code: tpl.code,
      levels: levelMap,
    };
  });
}

export function createSeedLanguageTests(): SchoolTest[] {
  const levels: LanguageLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
  const now = new Date().toISOString();
  const tests: SchoolTest[] = [];

  for (const tpl of LANG_TEMPLATES) {
    for (const lvl of levels) {
      const questions: TestQuestion[] = [];
      for (let i = 0; i < 20; i++) {
        const w = tpl.words[i % tpl.words.length];
        const wrong1 = tpl.words[(i + 1) % tpl.words.length].uz;
        const wrong2 = tpl.words[(i + 2) % tpl.words.length].uz;
        const wrong3 = tpl.words[(i + 3) % tpl.words.length].uz;
        questions.push({
          id: `lq-${tpl.id}-${lvl}-${i + 1}`,
          question: `${i + 1}. [${tpl.nameUz} · ${lvl}] "${w.w}" so‘zining tarjimasi qaysi?`,
          options: [w.uz, wrong1 === w.uz ? 'Qalam' : wrong1, wrong2 === w.uz ? 'Daftar' : wrong2, wrong3 === w.uz ? 'Sinf' : wrong3],
          correctIndex: 0,
          explanation: `"${w.w}" (${w.ph}) — "${w.uz}". Misol: ${w.ex}`,
        });
      }
      tests.push({
        id: `ltest-${tpl.id}-${lvl}`,
        title: `${tpl.nameUz} (${lvl}) — 20 savollik yakuniy test`,
        grade: 0,
        subjectId: 'language_center',
        languageCourseId: tpl.id,
        languageLevel: lvl,
        durationMinutes: 20,
        questions,
        teacherId: 'user-teacher-2',
        createdAt: now,
      });
    }
  }
  return tests;
}
