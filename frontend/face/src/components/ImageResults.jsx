import React from 'react';

function ImageResults({ results }) {
  return (
    <div className="results">
      {results.map((result, index) => (
        <div key={result.path + index} className="result">
          <img src={result.image} alt={result.path} />
          <p>Score: {result.score.toFixed(3)}</p>
        </div>
      ))}
    </div>
  );
}

export default ImageResults;