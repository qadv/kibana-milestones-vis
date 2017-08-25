import _ from 'lodash';
import { uiModules } from 'ui/modules';
import Milestones from './milestones';
import AggConfigResult from 'ui/vis/agg_config_result';
import { FilterBarClickHandlerProvider } from 'ui/filter_bar/filter_bar_click_handler';

const module = uiModules.get('kibana/milestones', ['kibana']);
module.controller('KbnMilestonesController', function ($scope, $element, Private, getAppState) {

  const containerNode = $element[0];
  const filterBarClickHandler = Private(FilterBarClickHandlerProvider);
  const truncated = false;

  const milestones = new Milestones(containerNode);
  milestones.on('select', (event) => {
    const appState = getAppState();
    const clickHandler = filterBarClickHandler(appState);
    const aggs = $scope.vis.aggs.getResponseAggs();
    const aggConfigResult = new AggConfigResult(aggs[0], false, event, event);
    clickHandler({ point: { aggConfigResult: aggConfigResult } });
  });

  milestones.on('renderComplete', () => {
    $scope.renderComplete();
  });

  $scope.$watch('esResponse', async function (response) {
    if (!response) {
      milestones.setData([]);
      return;
    }

    const histogramAggId = _.first(_.pluck($scope.vis.aggs.bySchemaName.segment, 'id'));
    if (!histogramAggId || !response.aggregations) {
      milestones.setData([]);
      return;
    }

    milestones.setInterval(_.first($scope.vis.aggs.bySchemaName.segment).buckets.getInterval().esUnit);

    const categoryAggId = _.first(_.pluck($scope.vis.aggs.bySchemaName.categories, 'id'));
    const titleAggId = _.first(_.pluck($scope.vis.aggs.bySchemaName.milestone_title, 'id'));

    if (typeof response.aggregations[histogramAggId] !== 'undefined') {
      const buckets = response.aggregations[histogramAggId].buckets;

      const events = buckets.reduce((p, bucket) => {
        bucket[titleAggId].buckets.map(title => {
          p.push({
            timestamp: bucket.key_as_string.split('.')[0],
            text: title.key
          });
        });
        return p;
      }, []);
      milestones.setData(events);
    } else if (typeof response.aggregations[categoryAggId] !== 'undefined') {
      const buckets = response.aggregations[categoryAggId].buckets;
      const data = [];
      _.each(buckets, bucket => {
        if (typeof bucket[histogramAggId] !== 'undefined') {
          const events = bucket[histogramAggId].buckets.reduce((p, nestedBucket) => {
            nestedBucket[titleAggId].buckets.map(title => {
              p.push({
                timestamp: nestedBucket.key_as_string.split('.')[0],
                text: title.key
              });
            });
            return p;
          }, []);
          data.push({
            category: bucket.key,
            entries: events
          });
        }
      });
      milestones.setData(data);
    }
  });

  $scope.$watch('resize', () => {
    milestones.resize();
  });
});
