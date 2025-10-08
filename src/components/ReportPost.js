import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const ReportPost = ({ post, onClose, onReportSubmitted, className = '' }) => {
  const [showModal, setShowModal] = useState(true); // Start with modal open since it's called when modal should be shown
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const modalRef = useRef(null);

  const reportReasons = [
    'Spam or misleading',
    'Harassment or bullying',
    'Violence or harm',
    'False information',
    'Hate speech',
    'Inappropriate content',
    'Copyright violation',
    'Other'
  ];

  const handleClose = useCallback(() => {
    setShowModal(false);
    setReason('');
    setDescription('');
    setSubmitted(false);
    if (onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [showModal, handleClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('reports')
        .insert({
          post_id: post.id,
          reporter_id: user.id,
          reason: reason,
          description: description,
          status: 'pending'
        });

      if (error) throw error;

      setSubmitted(true);
      if (onReportSubmitted) onReportSubmitted();
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error reporting post:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="report-modal-overlay">
        <div ref={modalRef} className="report-modal-content">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Report Submitted
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Thank you for your report. We'll review it and take appropriate action.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <div className="report-modal-overlay">
          <div ref={modalRef} className="report-modal-content">
            <div className="report-modal-header">
              <h3>Report Post</h3>
              <button
                onClick={handleClose}
                className="close-button"
              >
                ×
              </button>
            </div>

            <div className="report-modal-body">
              {/* Reported Post Preview */}
              <div className="reported-post-preview">
                <h4>Post being reported:</h4>
                <p>{post.content}</p>
                {post.image_url && (
                  <img src={post.image_url} alt="Post content" />
                )}
                {post.video_url && (
                  <video controls>
                    <source src={post.video_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>

              <form onSubmit={handleSubmit} className="report-form">
                <div className="form-group">
                  <label>Reason for reporting</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="report-select"
                    required
                  >
                    <option value="">Select a reason</option>
                    {reportReasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Additional details (optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="report-textarea"
                    placeholder="Please provide any additional context..."
                    maxLength="500"
                  />
                  <div className="character-count">
                    {description.length}/500 characters
                  </div>
                </div>

                <div className="report-actions">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !reason}
                    className="submit-report-button"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportPost; 