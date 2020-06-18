$.fn.shiftSelectable = function() {
  var lastChecked,
      $boxes = this;

  $boxes.click(function(evt) {
      if(!lastChecked) {
          lastChecked = this;
          return;
      }

      if(evt.shiftKey) {
          var start = $boxes.index(this),
              end = $boxes.index(lastChecked);
              $boxes.slice(Math.min(start, end), Math.max(start, end) + 1).each(function(){
                this.checked = lastChecked.checked;
                $(this).trigger('change');
              });
      }

      lastChecked = this;
  });
};
