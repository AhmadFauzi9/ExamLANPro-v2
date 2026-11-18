/**
 * ExamLAN Pro - Question Navigation Palette & Badges Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { renderCurrentQuestion } from './QuestionCard.js';

export function isQuestionAnswered(val) {
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
}

export function renderBullets() {
    const quiz = ExamContext.currentQuiz;
    if (!quiz || !quiz.questions) return;

    const currentIdx = ExamContext.currentQuestionIdx;
    const answers = ExamContext.studentAnswers || {};

    const html = quiz.questions.map((_, idx) => {
        const isAnswered = isQuestionAnswered(answers[idx]);
        const isCurrent = idx === currentIdx;
        let bgClass = "bg-slate-200 text-slate-600";
        if (isCurrent) bgClass = "bg-brand-600 text-white ring-2 ring-brand-300 font-bold";
        else if (isAnswered) bgClass = "bg-emerald-500 text-white";
        return `<button type="button" onclick="jumpToQuestion(${idx})" class="w-8 h-8 text-xs rounded-lg flex items-center justify-center transition-all ${bgClass}" title="Soal ${idx + 1}">${idx + 1}</button>`;
    }).join('');

    const container = document.getElementById('question-bullets');
    if (container) container.innerHTML = html;

    const sidebar = document.getElementById('question-sidebar');
    if (sidebar) sidebar.innerHTML = html;

    const answeredCount = quiz.questions.filter((_, idx) => isQuestionAnswered(answers[idx])).length;
    const countEl = document.getElementById('answered-count');
    if (countEl) countEl.textContent = `${answeredCount}/${quiz.questions.length}`;
}

export function jumpToQuestion(idx) {
    const quiz = ExamContext.currentQuiz;
    if (!quiz || !quiz.questions || idx < 0 || idx >= quiz.questions.length) return;
    ExamContext.setQuestionIndex(idx);
    renderCurrentQuestion();
}

window.jumpToQuestion = jumpToQuestion;
