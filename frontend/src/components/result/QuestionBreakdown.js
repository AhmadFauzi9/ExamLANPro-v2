/**
 * ExamLAN Pro - Question Breakdown & Review Component
 */

import { StudentContext } from '../../context/StudentContext.js';
import { ExamContext } from '../../context/ExamContext.js';
import { reviewApi } from '../../api/reviewApi.js';
import { formatImageUrl } from '../../utils/formatters.js';

let reviewPollInterval = null;

export function stopReviewPermissionPolling() {
    if (reviewPollInterval) {
        clearInterval(reviewPollInterval);
        reviewPollInterval = null;
    }
}

export async function startReviewPermissionPolling() {
    stopReviewPermissionPolling();
    await checkReviewPermission();
    reviewPollInterval = setInterval(checkReviewPermission, 3000);
}

export async function checkReviewPermission() {
    const token = StudentContext.reviewToken;
    if (!token) return;

    try {
        const res = await reviewApi.getReview(token);
        const data = res.data;
        const status = document.getElementById('answer-review-status');
        const listContainer = document.getElementById('breakdown-list');
        if (!status || !listContainer) return;

        if (data?.allowed) {
            status.innerText = 'Guru telah membuka jawaban dan pembahasan.';
            if (data.breakdowns) renderSecureBreakdowns(data.breakdowns);
            listContainer.classList.remove('hidden');
            ExamContext.setAnswerReviewVisible(true);
        } else {
            status.innerText = 'Jawaban benar dan pembahasan disembunyikan oleh guru.';
            listContainer.classList.add('hidden');
            listContainer.innerHTML = '';
            delete listContainer.dataset.loaded;
            ExamContext.setAnswerReviewVisible(false);
        }
    } catch (err) {
        console.error('Gagal memeriksa izin pembahasan:', err);
    }
}

export function renderSecureBreakdowns(breakdowns) {
    const listContainer = document.getElementById('breakdown-list');
    if (!listContainer || !Array.isArray(breakdowns)) return;

    listContainer.dataset.loaded = '1';
    listContainer.innerHTML = breakdowns.map((item, idx) => {
        const q = item.question || {};
        const statusBadge = item.isCorrect ?
            `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-check mr-1"></i> Benar</span>` :
            `<span class="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-xmark mr-1"></i> Salah / Belum Tepat</span>`;

        return `
            <div class="p-4 sm:p-5 rounded-xl border ${item.isCorrect ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'} space-y-3">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Soal ${idx + 1}. ${q.question || 'Analisis Pernyataan & Kasus'}</h4>
                    ${statusBadge}
                </div>
                ${q.image ? `<div class="my-2 flex justify-center"><img src="${formatImageUrl(q.image)}" alt="Lampiran Soal" class="max-w-full h-auto rounded-lg shadow-sm object-contain max-h-64"></div>` : ''}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div class="bg-white p-3 rounded-lg border border-slate-200">
                        <span class="font-bold text-slate-500 block mb-1">Jawaban Anda:</span>
                        <div class="text-slate-800 font-medium">${item.studentAnswerText || 'Tidak dijawab'}</div>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-slate-200">
                        <span class="font-bold text-emerald-700 block mb-1">Kunci / Jawaban Tepat:</span>
                        <div class="text-slate-800 font-medium">${item.correctAnswerText || '-'}</div>
                    </div>
                </div>
                ${q.explanation ? `
                    <div class="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                        <strong class="flex items-center gap-1 text-amber-800"><i class="fa-solid fa-lightbulb text-amber-600"></i> Pembahasan:</strong>
                        <p class="leading-relaxed">${q.explanation}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}
