
      function getScript(source, callback) {
        var script = document.createElement('script');
        var prior = document.getElementsByTagName('script')[0];
        script.async = 1;

        script.onload = script.onreadystatechange = function( _, isAbort ) {
          if(isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
            script.onload = script.onreadystatechange = null;
            script = undefined;

            if(!isAbort && callback) setTimeout(callback, 0);
          }
        };

        script.src = source;
        prior.parentNode.insertBefore(script, prior);
        };

        getScript('https://www.googletagmanager.com/gtag/js?id=AW-11409537452', function(){


  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-11409537452');


});
    