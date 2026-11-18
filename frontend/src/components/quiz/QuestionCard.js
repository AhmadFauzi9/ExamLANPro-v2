/**
 * ExamLAN Pro - Question Card & Content Display Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { getQuestionTypeLabel, getQuestionTypeInstruction, formatImageUrl } from '../../utils/formatters.js';
import { renderQuestionOptions } from './OptionRenderer.js';
import { updateNavControls } from './QuizNavigation.js';
import { renderBullets } from './QuestionPalette.js';
import { setText } from '../../utils/dom.js';

export function renderCurrentQuestion() {
    const quiz = ExamContext.currentQuiz;
    if (!quiz || !quiz.questions || !quiz.questions.length) return;

    const idx = ExamContext.currentQuestionIdx;
    const q = quiz.questions[idx];
    const container = document.getElementById('question-card');
    if (!container || !q) return;

    setText('#current-question-num', idx + 1);

    const typeLabel = getQuestionTypeLabel(q.type);
    const typeInstruction = getQuestionTypeInstruction(q.type);

    let contentHtml = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 px-3 py-1 rounded-full border border-brand-200">
                    ${typeLabel}
                </span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50/90 px-3 py-1 rounded-xl border border-amber-200/90 shadow-2xs">
                <i class="fa-solid fa-circle-question text-amber-600 text-xs shrink-0"></i>
                <span class="font-medium">${typeInstruction}</span>
            </div>
        </div>
    `;

    if (q.type === 'case_analysis') {
        contentHtml += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif italic border-l-4 border-l-brand-600">
                <strong class="block not-italic font-sans text-slate-900 mb-1"><i class="fa-solid fa-book-open text-brand-600 mr-1"></i> Teks Studi Kasus:</strong>
                ${q.passage || ''}
            </div>
        `;
    }

    if (q.type === 'cause_effect') {
        contentHtml += `
            <div class="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <p class="font-bold text-slate-800"><i class="fa-solid fa-circle-info text-brand-600 mr-1"></i> Pernyataan Utama:</p>
                <p class="text-slate-700 pl-4 border-l-2 border-slate-300">"${q.statement || ''}"</p>
                <p class="font-bold text-slate-800 pt-2"><i class="fa-solid fa-link text-brand-600 mr-1"></i> Alasan:</p>
                <p class="text-slate-700 pl-4 border-l-2 border-slate-300">"${q.reason || ''}"</p>
            </div>
        `;
    } else {
        contentHtml += `<h4 class="text-base sm:text-lg font-bold text-slate-800 leading-snug">${q.question || ''}</h4>`;
    }

    // Sisipkan Tag Gambar Responsif jika ada
    if (q.image) {
        contentHtml += `
            <div class="my-3 flex justify-center">
                <img src="${formatImageUrl(q.image)}" alt="Lampiran Soal" class="max-w-full h-auto rounded-lg mb-4 shadow-sm object-contain max-h-96">
            </div>
        `;
    }

    // Render options berdasarkan tipe soal
    const currentAnswer = ExamContext.studentAnswers[idx];
    contentHtml += renderQuestionOptions(q, currentAnswer);

    container.innerHTML = contentHtml;

    updateNavControls();
    renderBullets();
}
