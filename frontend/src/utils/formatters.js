/**
 * ExamLAN Pro - String & Number Formatting Helpers
 */

export const TYPE_LABELS = {
    'mc': 'Pilihan Ganda',
    'complex': 'Pilihan Ganda Kompleks',
    'matching': 'Menjodohkan',
    'short_answer': 'Isian Singkat',
    'essay': 'Uraian / Esai',
    'cause_effect': 'Sebab Akibat',
    'case_analysis': 'Analisis Kasus',
    'scaled': 'Pilihan Berskala (Likert)'
};

export const TYPE_INSTRUCTIONS = {
    'mc': 'Pilihlah salah satu jawaban yang paling tepat.',
    'complex': 'Pilihlah satu atau lebih jawaban yang benar (jawaban bisa lebih dari satu).',
    'matching': 'Pasangkan setiap pernyataan di kolom kiri dengan jawaban yang sesuai di kolom kanan.',
    'short_answer': 'Ketikkan jawaban singkat Anda dengan tepat pada kotak isian yang tersedia.',
    'essay': 'Tuliskan jawaban atau uraian lengkap Anda pada kolom yang disediakan.',
    'cause_effect': 'Analisis hubungan sebab-akibat antara pernyataan dan alasan, lalu tentukan pilihan yang tepat.',
    'case_analysis': 'Cermati teks studi kasus di bawah ini, lalu pilihlah salah satu jawaban yang paling tepat.',
    'scaled': 'Pilihlah opsi skala yang paling sesuai dengan penilaian atau kondisi Anda.'
};

export function formatSeconds(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatIndonesianDate(date = new Date()) {
    try {
        return new Intl.DateTimeFormat('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date instanceof Date ? date : new Date(date));
    } catch (e) {
        return new Date().toLocaleDateString('id-ID');
    }
}

export function getQuestionTypeLabel(type) {
    return TYPE_LABELS[type] || 'Soal Pilihan Ganda';
}

export function getQuestionTypeInstruction(type) {
    return TYPE_INSTRUCTIONS[type] || 'Pilihlah jawaban yang paling tepat.';
}

export function formatImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return url;
    }
    return url.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
}
