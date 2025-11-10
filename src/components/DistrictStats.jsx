import { formatNumber, calculatePercentage, getDistrictRivers } from "../services/api";
import "../styles/DistrictStats.css";

export default function DistrictStats({
  district,
  districtData,
  totalCatch,
  rivers = [],
  isDateRange = false,
}) {
  if (!district || !districtData) {
    return null;
  }

  const dailyCatchPercentage = calculatePercentage(
    districtData.catchDaily,
    totalCatch
  );

  const districtRivers = rivers.filter(
    (r) => r.district === district.id
  );

  // Helper function to check if a value is effectively zero
  const isZeroOrMissing = (value) => {
    return value === 0 || value === "0" || !value || value === null || value === undefined;
  };

  return (
    <div className="district-stats-container">
      <div className="stats-header">
        <div className="stats-title">
          <span className="stats-icon">{district.icon}</span>
          <h3>{district.name}</h3>
        </div>
      </div>

      {/* Main Stats */}
      
      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-label">Daily Catch</span>
          <span className="stat-value">{formatNumber(districtData.catchDaily)}</span>
          {isZeroOrMissing(districtData.catchDaily) && (
            <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
          )}
          <span className="stat-percentage">{dailyCatchPercentage}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Cumulative Catch</span>
          <span className="stat-value">{formatNumber(districtData.catchCumulative)}</span>
          {isZeroOrMissing(districtData.catchCumulative) && (
            <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
          )}
        </div>

        <div className="stat-box">
          <span className="stat-label">Daily Escapement</span>
          <span className="stat-value">{formatNumber(districtData.escapementDaily)}</span>
          {isZeroOrMissing(districtData.escapementDaily) && (
            <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
          )}
        </div>

        <div className="stat-box">
          <span className="stat-label">Cumulative Escapement</span>
          <span className="stat-value">{formatNumber(districtData.escapementCumulative)}</span>
          {isZeroOrMissing(districtData.escapementCumulative) && (
            <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
          )}
        </div>

        <div className="stat-box">
          <span className="stat-label">Total Run</span>
          <span className="stat-value">{formatNumber(districtData.totalRun)}</span>
          {isZeroOrMissing(districtData.totalRun) && (
            <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
          )}
        </div>

        {districtData.sockeyePerDelivery && (
          <div className="stat-box">
            <span className="stat-label">Sockeye per Delivery</span>
            <span className="stat-value">{formatNumber(districtData.sockeyePerDelivery)}</span>
            {isZeroOrMissing(districtData.sockeyePerDelivery) && (
              <span className="stat-note">**ADF&G did not collect this data on the selected date</span>
            )}
            <span className="stat-note1">
              (District-wide average for this date)
            </span>
          </div>
        )}
      </div>
      

      {/* River Breakdown */}
      {districtRivers.length > 0 && (
        <div className="rivers-section">
          <h4 className="rivers-title">Rivers in {district.name}</h4>
          <div className="rivers-list">
            {districtRivers.map((river) => {
              const riverEscapementPercentage = calculatePercentage(
                river.escapementDaily,
                districtData.escapementDaily
              );

              return (
                <div key={river.name} className="river-item">
                  <div className="river-info">
                    <span className="river-name">🌊 {river.name}</span>
                    <span className="river-escapement">
                      {formatNumber(river.escapementDaily)} escapement
                    </span>
                  </div>
                  <div className="river-percentage">
                    {riverEscapementPercentage}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Range Info */}
      {isDateRange && (
        <div className="range-info-box">
          <span className="range-label">📊 Aggregated Range Data</span>
        </div>
      )}
    </div>
  );
}