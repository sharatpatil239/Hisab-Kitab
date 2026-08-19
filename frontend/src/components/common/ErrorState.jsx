const ErrorState = ({ message = "Something went wrong. Please try again.", onRetry }) => {
  return (
    <div className="state-block error-state">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
