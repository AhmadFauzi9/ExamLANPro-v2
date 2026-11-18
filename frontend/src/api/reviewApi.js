/**
 * ExamLAN Pro - Review & Evaluation API
 */

import { apiRequest } from './apiClient.js';

export const reviewApi = {
    /**
     * Memeriksa apakah guru sudah membuka akses pembahasan dan kunci jawaban
     */
    async getReview(reviewToken) {
        return apiRequest('get_review', {
            data: { token: reviewToken }
        });
    }
};
