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
          <span className="stat-percentage">{dailyCatchPercentage}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Cumulative Catch</span>
          <span className="stat-value">{formatNumber(districtData.catchCumulative)}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Daily Escapement</span>
          <span className="stat-value">{formatNumber(districtData.escapementDaily)}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Cumulative Escapement</span>
          <span className="stat-value">{formatNumber(districtData.escapementCumulative)}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Total Run</span>
          <span className="stat-value">{formatNumber(districtData.totalRun)}</span>
        </div>

        {districtData.inRiverEstimate && (
          <div className="stat-box">
            <span className="stat-label">In-River Estimate</span>
            <span className="stat-value">{formatNumber(districtData.inRiverEstimate)}</span>
          </div>
        )}

        {districtData.sockeyePerDelivery && (
          <div className="stat-box">
            <span className="stat-label">Sockeye per Delivery</span>
            <span className="stat-value">{formatNumber(districtData.sockeyePerDelivery)}</span>
            <span className="stat-note">
              (Lower = more boats working harder; Higher = fewer boats catching more)
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