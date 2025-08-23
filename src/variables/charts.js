export const getBarChartConfig = (monthlyBookingsData) => {
  const labels = monthlyBookingsData.labels;
  const data = monthlyBookingsData.data;

  return {
    chartData: {
      labels: labels,
      datasets: [
        {
          label: "Completed Bookings",
          data: data,
          backgroundColor: "#FF7D2E",
          borderColor: "#FF7D2E",
          borderWidth: 1,
        },
      ],
    },
    chartOptions: {
      responsive: true,
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#A0AEC0",
          },
        },
        y: {
          display: false, // Hide Y-axis
          grid: {
            display: false, // Hide Y-axis grid lines
          },
          ticks: {
            display: false, // Hide Y-axis tick labels
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y;
              }
              return label;
            }
          }
        },
        legend: {
          position: 'top',
          display: false,
        },
        title: {
          display: false,
          text: 'Completed Bookings Last 6 Months',
        },
      },
    },
  };
};


export const lineChartData = [
  {
    name: "Mobile apps",
    data: [50, 40, 300, 220, 500, 250, 400, 230, 500, 0, 0, 0],
  },
  {
    name: "Websites",
    data: [30, 90, 40, 140, 290, 290, 340, 230, 400, 0, 0, 0],
  },
];

export const lineChartOptions = {
  chart: {
    toolbar: {
      show: false,
    },
  },
  tooltip: {
    theme: "dark",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: "smooth",
  },
  xaxis: {
    type: "category",
    categories: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    axisTicks: {
      show: false
    },
    axisBorder: {
      show: false,
    },
    labels: {
      style: {
        colors: "#fff",
        fontSize: "12px",
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: "#fff",
        fontSize: "12px",
      },
    },
  },
  legend: {
    show: false,
  },
  grid: {
    strokeDashArray: 5,
  },
  fill: {
    type: "gradient",
    gradient: {
      shade: "light",
      type: "vertical",
      shadeIntensity: 0.5,
      inverseColors: true,
      opacityFrom: 0.8,
      opacityTo: 0,
      stops: [],
    },
    colors: ["#fff", "#FF7D2E"],
  },
  colors: ["#fff", "#FF7D2E"],
};
