(function ($, Drupal) {
    Drupal.behaviors.myfeature = {
        attach(context) {
            const $elements = $(context).find('[data-myfeature]').once('myfeature');
            // `$elements` is always a jQuery object.
            $elements.each(processingCallback);
        }
    };

    function processingCallback(index, value) {
    }
})(jQuery, Drupal);
