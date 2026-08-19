const LoadingState = ({ label = "Loading..." }) => {
  return (
    <div className="state-block loading-state">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
};

export default LoadingState;
