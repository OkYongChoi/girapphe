import type { Locale } from '@stem-brain/shared';

export const METADATA_COPY: Record<Locale, { title: string; description: string; imageAlt: string }> = {
  en: {
    title: 'STEMBrain | Personal STEM Knowledge Graph',
    description: 'Practice STEM concepts, review weak spots, and build a personal knowledge graph across science, computing, and engineering.',
    imageAlt: 'STEMBrain knowledge graph logo',
  },
  ja: {
    title: 'STEMBrain | 自分だけのSTEM知識グラフ',
    description: 'STEMの概念を練習し、苦手分野を復習しながら、科学・コンピューティング・工学にまたがる自分だけの知識グラフを構築できます。',
    imageAlt: 'STEMBrain知識グラフのロゴ',
  },
  'zh-CN': {
    title: 'STEMBrain | 个人 STEM 知识图谱',
    description: '练习 STEM 概念，复习薄弱环节，并构建涵盖科学、计算机与工程领域的个人知识图谱。',
    imageAlt: 'STEMBrain 知识图谱标志',
  },
  es: {
    title: 'STEMBrain | Grafo personal de conocimiento STEM',
    description: 'Practica conceptos STEM, repasa tus puntos débiles y crea un grafo personal de conocimiento sobre ciencia, informática e ingeniería.',
    imageAlt: 'Logotipo del grafo de conocimiento de STEMBrain',
  },
  ar: {
    title: 'STEMBrain | رسم معرفي شخصي لمجالات STEM',
    description: 'تدرّب على مفاهيم STEM، وراجع نقاط الضعف، وابنِ رسمًا معرفيًا شخصيًا يغطي العلوم والحوسبة والهندسة.',
    imageAlt: 'شعار الرسم المعرفي لـ STEMBrain',
  },
  hi: {
    title: 'STEMBrain | आपका व्यक्तिगत STEM ज्ञान ग्राफ',
    description: 'STEM अवधारणाओं का अभ्यास करें, कमज़ोर विषयों की समीक्षा करें और विज्ञान, कंप्यूटिंग और इंजीनियरिंग का व्यक्तिगत ज्ञान ग्राफ बनाएँ।',
    imageAlt: 'STEMBrain ज्ञान ग्राफ लोगो',
  },
};
