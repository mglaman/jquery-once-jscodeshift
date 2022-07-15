(function (Drupal, $, once) {
    Drupal.behaviors.myfeature = {
        attach(context) {
            // The once call is wrapped in $() to allow the usual jQuery chaining.
            const $elements =  $(once('myfeature', '[data-myfeature]', context));
            // `$elements` is always a jQuery object.
            $elements.each(processingCallback);
        }
    };

    function processingCallback(index, value) {}
}(Drupal, jQuery, once));