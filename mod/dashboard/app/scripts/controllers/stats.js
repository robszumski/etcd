'use strict';

angular.module('etcdStats', ['ngRoute', 'etcd'])

.config(['$routeProvider', function ($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'views/stats.html',
      controller: 'StatsCtrl'
    })
    .otherwise({
      templateUrl: 'views/stats.html',
      controller: 'StatsCtrl'
    });
}])

.controller('StatsCtrl', ['$scope', 'EtcdV1', 'statsVega', function ($scope, EtcdV1, statsVega) {
  $scope.graphContainer = '#latency';
  $scope.graphVisibility = 'etcd-graph-show';
  $scope.tableVisibility = 'etcd-table-hide';

  //make requests
  function readStats() {
    EtcdV1.getStat('leader').get().success(function(data) {
      $scope.leaderStats = data;
      $scope.followers = [];
      $scope.followerNames = [];
      $.each(data.followers, function(index, value) {
        value.name = index;
        $scope.followers.push(value);
        $scope.followerNames.push(value.name);
      });
      drawCubism();
    });
  }

  function drawGraph () {
    //hardcoded padding from chart json
    var vertPadding = 30;
    var horzPadding = 15;
    //fetch width and height of graph area
    var width = $($scope.graphContainer).width() - horzPadding;
    var height = $($scope.graphContainer).height() - vertPadding;

    // parse a spec and create a visualization view
    function parse(spec) {
      vg.parse.spec(spec, function(chart) {
        chart({
          el: $scope.graphContainer,
          data: {
            'stats': $scope.followers
          }
        }).width(width).height(height).update();
      });
    }
    parse(statsVega);
  }

  function drawCubism () {
    var context = cubism.context()
        .serverDelay(.25 * 1000)
        .step(1 * 1000)
        .size(parseInt($($scope.graphContainer).width()));

    d3.select("#latency").selectAll(".axis")
        .data(["top", "bottom"])
      .enter().append("div")
        .attr("class", function(d) { return d + " axis"; })
        .each(function(d) { d3.select(this).call(context.axis().ticks(12).orient(d)); });

    d3.select("#latency").append("div")
        .attr("class", "rule")
        .call(context.rule());

    d3.select("#latency .etcd-graph-content").selectAll(".horizon")
        .data($scope.followerNames.map(stock))
      .enter().append("div", ".bottom")
        .attr("class", "horizon")
      .call(context.horizon());

    context.on("focus", function(i) {
      d3.selectAll(".value").style("right", i == null ? null : context.size() - i + "px");
    });

    // Replace this with context.graphite and graphite.metric!
    function stock(name) {
      var format = d3.time.format("%d-%b-%y");
      return context.metric(function(start, stop, step, callback) {
        var value = null;
        $.each($scope.followers, function(index, follower) {
          if(follower.name == name) {
            value = follower.latency.current;
          }
        });
        callback(null, [value]);
      }, name);
    }
  }

  $scope.showTable = function() {
    $scope.tableVisibility = 'etcd-table-reveal';
  };

  $scope.showGraph = function() {
    $scope.tableVisibility = 'etcd-table-hide';
  };

  $scope.getHeight = function() {
    return $(window).height();
  };
  $scope.getWidth = function() {
    return $(window).width();
  };
  $scope.$watch($scope.getHeight, function() {
    $('.etcd-body').css('height', $scope.getHeight()-5);
    readStats();
  });
  $scope.$watch($scope.getWidth, function() {
    readStats();
  });
  window.onresize = function(){
    $scope.$apply();
  };

  // Update the graphs live
  setInterval(function() {
    readStats();
    $scope.$apply();
  }, 500);
}])


/* statsVega returns the vega configuration for the stats dashboard */
.factory('statsVega', function () {
  return {
    'padding': {'top': 10, 'left': 5, 'bottom': 40, 'right': 10},
    'data': [
      {
        'name': 'stats'
      },
      {
        'name': 'thresholds',
        'values': [50, 100]
      }
    ],
    'scales': [
      {
        'name': 'y',
        'type': 'ordinal',
        'range': 'height',
        'domain': {'data': 'stats', 'field': 'index'}
      },
      {
        'name': 'x',
        'range': 'width',
        'domainMin': 0,
        'domainMax': 100,
        'nice': true,
        'zero': true,
        'domain': {'data': 'stats', 'field': 'data.latency.current'}
      },
      {
        'name': 'color',
        'type': 'linear',
        'domain': [10, 50, 100, 1000000000],
        'range': ['#00DB24', '#FFC000', '#c40022', '#c40022']
      }
    ],
    'axes': [
      {
        'type': 'x',
        'scale': 'x',
        'ticks': 6,
        'name': 'Latency (ms)'
      },
      {
        'type': 'y',
        'scale': 'y',
        'properties': {
          'ticks': {
            'stroke': {'value': 'transparent'}
          },
          'majorTicks': {
            'stroke': {'value': 'transparent'}
          },
          'labels': {
            'fill': {'value': 'transparent'}
          },
          'axis': {
            'stroke': {'value': '#333'},
            'strokeWidth': {'value': 1}
          }
        }
      }
    ],
    'marks': [
      {
        'type': 'rect',
        'from': {'data': 'stats'},
        'properties': {
          'enter': {
            'x': {'scale': 'x', 'value': 0},
            'x2': {'scale': 'x', 'field': 'data.latency.current'},
            'y': {'scale': 'y', 'field': 'index', 'offset': -1},
            'height': {'value': 3},
            'fill': {'scale':'color', 'field':'data.latency.current'}
          }
        }
      },
      {
          'type': 'symbol',
          'from': {'data': 'stats'},
          'properties': {
            'enter': {
              'x': {'scale': 'x', 'field': 'data.latency.current'},
              'y': {'scale': 'y', 'field': 'index'},
              'size': {'value': 50},
              'fill': {'value': '#000'}
            }
          }
        }
      ]
    };
});
