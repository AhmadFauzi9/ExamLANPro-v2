/**
 * ExamLAN Pro - Question Option Renderer Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { queueAnswerSave } from '../../hooks/useAutoSave.js';
import { renderBullets } from './QuestionPalette.js';
import { escapeHtml } from '../../utils/dom.js';

export function saveStudentAnswer(val) {
    ExamContext.setAnswer(ExamContext.currentQuestionIdx, val);
    renderBullets();
    queueAnswerSave();
}

export function saveComplexAnswer(idx, isChecked) {
    const qIdx = ExamContext.currentQuestionIdx;
    let current = [...(ExamContext.studentAnswers[qIdx] || [])];
    if (isChecked) {
        if (!current.includes(idx)) current.push(idx);
    } else {
        current = current.filter(i => i !== idx);
    }
    ExamContext.setAnswer(qIdx, current);
    renderBullets();
    queueAnswerSave();
}

export function saveMatchingAnswer(premiseIdx, targetVal) {
    const qIdx = ExamContext.currentQuestionIdx;
    let current = { ...(ExamContext.studentAnswers[qIdx] || {}) };
    if (targetVal === '') {
        delete current[premiseIdx];
    } else {
        current[premiseIdx] = parseInt(targetVal);
    }
    ExamContext.setAnswer(qIdx, current);
    renderBullets();
    queueAnswerSave();
}

export function renderQuestionOptions(q, currentAnswer) {
    let contentHtml = `<div class="space-y-2.5 pt-2">`;

    if (q.type === 'mc' || q.type === 'case_analysis') {
        const selectedVal = currentAnswer;
        (q.options || []).forEach((opt, idx) => {
            const isChecked = selectedVal === idx;
            contentHtml += `
                <label class="flex items-center p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-50 border-brand-500 text-brand-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
                    <input type="radio" name="q_opt" value="${idx}" ${isChecked ? 'checked' : ''} onchange="saveStudentAnswer(${idx})" class="w-4 h-4 text-brand-600 focus:ring-brand-500">
                    <span class="ml-3 text-xs sm:text-sm font-medium">${String.fromCharCode(65 + idx)}. ${opt}</span>
                </label>
            `;
        });
    } else if (q.type === 'complex') {
        const selectedVals = Array.isArray(currentAnswer) ? currentAnswer : [];
        (q.options || []).forEach((opt, idx) => {
            const isChecked = selectedVals.includes(idx);
            contentHtml += `
                <label class="flex items-center p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-50 border-brand-500 text-brand-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
                    <input type="checkbox" value="${idx}" ${isChecked ? 'checked' : ''} onchange="saveComplexAnswer(${idx}, this.checked)" class="w-4 h-4 text-brand-600 rounded focus:ring-brand-500">
                    <span class="ml-3 text-xs sm:text-sm font-medium">${String.fromCharCode(65 + idx)}. ${opt}</span>
                </label>
            `;
        });
    } else if (q.type === 'matching') {
        const premises = q.premises || [];
        const targets = q.targets || [];
        const currentMatches = typeof currentAnswer === 'object' && currentAnswer !== null ? currentAnswer : {};
        contentHtml += `
            <div class="space-y-3 pt-1">
                <p class="text-xs text-slate-600 font-medium">Jodohkan setiap pernyataan di kolom kiri dengan pasangan yang tepat di kolom kanan:</p>
                <div class="space-y-2.5">
        `;
        premises.forEach((premise, pIdx) => {
            const selectedTarget = currentMatches[pIdx] !== undefined ? currentMatches[pIdx] : '';
            contentHtml += `
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 flex-1">
                        <span class="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">${pIdx + 1}</span>
                        <span class="text-xs sm:text-sm font-medium text-slate-800">${premise}</span>
                    </div>
                    <div class="sm:w-64 shrink-0">
                        <select onchange="saveMatchingAnswer(${pIdx}, this.value)" class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                            <option value="">-- Pilih Pasangan --</option>
                            ${targets.map((target, tIdx) => `
                                <option value="${tIdx}" ${selectedTarget !== '' && parseInt(selectedTarget) === tIdx ? 'selected' : ''}>
                                    ${String.fromCharCode(65 + tIdx)}. ${target}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `;
        });
        contentHtml += `</div></div>`;
    } else if (q.type === 'short_answer') {
        const currentVal = currentAnswer !== undefined ? currentAnswer : '';
        contentHtml += `
            <div class="space-y-2 pt-1">
                <label class="block text-xs font-semibold text-slate-700">Tuliskan Jawaban Singkat:</label>
                <input type="text" value="${currentVal}" oninput="saveStudentAnswer(this.value)" placeholder="Ketikkan jawaban Anda di sini..." class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 font-medium outline-none bg-white">
            </div>
        `;
    } else if (q.type === 'essay') {
        const currentVal = currentAnswer !== undefined && currentAnswer !== null ? currentAnswer : '';
        const charLen = String(currentVal).length;
        contentHtml += `
            <div class="space-y-2 pt-1">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-semibold text-slate-700">Tuliskan Jawaban Uraian / Esai:</label>
                    <span id="essay-char-counter" class="text-[11px] text-slate-400 font-mono">${charLen} karakter</span>
                </div>
                <textarea rows="6" oninput="saveStudentAnswer(this.value); const c = document.getElementById('essay-char-counter'); if (c) c.textContent = this.value.length + ' karakter';" placeholder="Ketikkan jawaban uraian lengkap Anda di sini..." class="w-full p-4 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 font-medium leading-relaxed outline-none bg-white transition">${escapeHtml(currentVal)}</textarea>
                <p class="text-[11px] text-slate-400 italic"><i class="fa-solid fa-cloud-arrow-up mr-1 text-brand-500"></i> Jawaban tersimpan otomatis secara real-time saat Anda mengetik.</p>
            </div>
        `;
    } else if (q.type === 'cause_effect') {
        const causeEffectOpts = [
            { key: 'both_correct_connected', letter: 'A', label: 'Pernyataan benar, alasan benar, dan keduanya menunjukkan hubungan sebab akibat' },
            { key: 'both_correct_not_connected', letter: 'B', label: 'Pernyataan benar, alasan benar, tetapi keduanya TIDAK menunjukkan hubungan sebab akibat' },
            { key: 'statement_true_reason_false', letter: 'C', label: 'Pernyataan BENAR dan alasan SALAH' },
            { key: 'statement_false_reason_true', letter: 'D', label: 'Pernyataan SALAH dan alasan BENAR' },
            { key: 'both_false', letter: 'E', label: 'Pernyataan dan alasan, keduanya SALAH' }
        ];
        const ceMap = {
            'a': 'both_correct_connected', '1': 'both_correct_connected', 'both_correct_connected': 'both_correct_connected', 'bothcorrectconnected': 'both_correct_connected',
            'b': 'both_correct_not_connected', '2': 'both_correct_not_connected', 'both_correct_not_connected': 'both_correct_not_connected', 'bothcorrectnotconnected': 'both_correct_not_connected',
            'c': 'statement_true_reason_false', '3': 'statement_true_reason_false', 'statement_true_reason_false': 'statement_true_reason_false', 'statement_correct_reason_wrong': 'statement_true_reason_false', 'statementtruereasonfalse': 'statement_true_reason_false', 'statementcorrectreasonwrong': 'statement_true_reason_false',
            'd': 'statement_false_reason_true', '4': 'statement_false_reason_true', 'statement_false_reason_true': 'statement_false_reason_true', 'statement_wrong_reason_correct': 'statement_false_reason_true', 'statementfalsereasontrue': 'statement_false_reason_true', 'statementwrongreasoncorrect': 'statement_false_reason_true',
            'e': 'both_false', '5': 'both_false', 'both_false': 'both_false', 'both_wrong': 'both_false', 'bothfalse': 'both_false', 'bothwrong': 'both_false'
        };
        const rawSelected = currentAnswer;
        const cleanKey = String(rawSelected || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const selectedCanonical = ceMap[cleanKey] || rawSelected;

        causeEffectOpts.forEach((opt) => {
            const isChecked = selectedCanonical === opt.key;
            contentHtml += `
                <label class="flex items-start p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-50 border-brand-500 text-brand-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
                    <input type="radio" name="q_opt" value="${opt.key}" ${isChecked ? 'checked' : ''} onchange="saveStudentAnswer('${opt.key}')" class="w-4 h-4 text-brand-600 focus:ring-brand-500 mt-0.5">
                    <span class="ml-3 text-xs sm:text-sm font-medium leading-normal"><strong class="text-brand-700">${opt.letter}.</strong> ${opt.label}</span>
                </label>
            `;
        });
    } else if (q.type === 'scaled') {
        const selectedVal = currentAnswer;
        (q.options || []).forEach((opt, idx) => {
            const isChecked = selectedVal === idx;
            contentHtml += `
                <label class="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-50 border-brand-500 text-brand-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
                    <div class="flex items-center">
                        <input type="radio" name="q_opt" value="${idx}" ${isChecked ? 'checked' : ''} onchange="saveStudentAnswer(${idx})" class="w-4 h-4 text-brand-600 focus:ring-brand-500">
                        <span class="ml-3 text-xs sm:text-sm font-medium">${opt.text}</span>
                    </div>
                    <span class="text-xs font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">Poin: ${opt.score}</span>
                </label>
            `;
        });
    }

    contentHtml += `</div>`;
    return contentHtml;
}

// Bind to window for inline onchange attributes
window.saveStudentAnswer = saveStudentAnswer;
window.saveComplexAnswer = saveComplexAnswer;
window.saveMatchingAnswer = saveMatchingAnswer;
