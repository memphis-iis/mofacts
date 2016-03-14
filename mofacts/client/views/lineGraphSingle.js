Template.lineGraphSingle.rendered = function () {

   new Chartist.Line('.ct-chart', {
      labels: [1, 2, 3, 4, 5, 6, 7, 8],
      series: [[5, 4, 5, 4, 3, 2, 1, 2]]
   }, {
      low: 0,
      fullWidth: true,
      height: 300,
      axisY: {
         onlyInteger: true,
         offset: 20
      }
   });
}
