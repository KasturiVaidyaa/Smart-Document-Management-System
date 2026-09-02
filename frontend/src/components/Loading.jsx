    export const LoadingAnimation = () => {
    return (
      <div className="relative">
        <div className="inline-block w-6 h-6 border-2 border-t-2 border-r-transparent border-green-500 rounded-full animate-spin"></div>
        <div className="absolute top-0 left-0 inline-block w-6 h-6 border-2 border-t-transparent border-r-transparent border-b-2 border-l-transparent border-green-300 rounded-full animate-ping opacity-75"></div>
      </div>
    );
  };
  
  export const Loading = () => {
    return (
      <div className="flex items-center justify-center max-h-screen mt-36">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-500"></div>
          <div className="absolute top-1 left-1 animate-spin rounded-full h-14 w-14 border-b-4 border-green-300" style={{animationDirection: 'reverse', animationDuration: '1.2s'}}></div>
          <div className="absolute top-3 left-3 animate-pulse rounded-full h-10 w-10 bg-green-100 opacity-50"></div>
        </div>
      </div>
    );
  };
  