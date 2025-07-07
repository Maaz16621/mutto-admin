import React, { Component } from "react";
import Chart from "react-apexcharts";

class BarChart extends Component {
  render() {
    const chartData = this.props.chartData || [];
    const chartOptions = this.props.chartOptions || {};
    return (
      <Chart
        options={chartOptions}
        series={chartData}
        type="bar"
        width="100%"
        height="100%"
      />
    );
  }
}

export default BarChart;
