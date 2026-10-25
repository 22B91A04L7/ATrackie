import LoadingFeedback from "./LoadingFeedback";
function DeleteApplication({ isOpen, isDeleting, error, onCancel, onConfirm }) {
  if (!isOpen) {
    return null;
  }

  return (
    <section
      id="delete-application-confirmation"
      className="delete-confirmation"
      role="alertdialog"
      aria-labelledby="delete-confirmation-title"
      aria-describedby="delete-confirmation-description"
      aria-busy={isDeleting}
    >
      <div className="delete-confirmation-copy">
        <h2 id="delete-confirmation-title">Delete this application?</h2>

        <p id="delete-confirmation-description">
          This will permanently remove this application from your tracker.
        </p>

        <LoadingFeedback active={isDeleting} label="Deleting application..." />
        {error && (
          <p className="delete-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="delete-confirmation-actions">
        <button
          className="delete-cancel-button"
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </button>

        <button
          className="delete-confirm-button"
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete Application"}
        </button>
      </div>
    </section>
  );
}

export default DeleteApplication;
