/**
 * Copyright (c) 2010 Arnaud Leymet
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Chrome Tab Sugar <http://github.com/arnaud/chrome-tab-sugar>
 */

// keep a reference of the background page
var back = chrome.extension.getBackgroundPage();


$(function () {
    $('h1').html('Tab Sugar ' + chrome.i18n.getMessage("optionsTitle"));
    $('h2').html(chrome.i18n.getMessage("optionsTitle"));
    $('.activate').html(chrome.i18n.getMessage("optionsActivate"));
    $('.experimental').html('(' + chrome.i18n.getMessage("optionsExperimental") + ')');
    $('#devmode')
        .on('click', devmode)
        .html(chrome.i18n.getMessage("optionsDevMode"));
    $('#reinit')
        .on('click', reinitialize)
        .parent()
        .find('>label')
        .first()
        .html(chrome.i18n.getMessage("optionsDevMode") + ':');
    $('#preview')
        .on('click', preview)
        .parent()
        .find('>label')
        .first()
        .html(chrome.i18n.getMessage("optionsFeatureTabsPreview") + ':');
    $('#autoresize').parent().find('>label').first().html(chrome.i18n.getMessage("optionsFeatureRearrangeTabs") + ':');
    $('#snapgroups').parent().find('>label').first().html(chrome.i18n.getMessage("optionsFeatureSnapGroups") + ':');
    $('#shortcut_key').parent().find('>label').first().html(chrome.i18n.getMessage("optionsFeatureKeyboardShortcut") + ':');
    $('#updates')
        .on('click', updates)
        .parent()
        .find('>label')
        .first()
        .html(chrome.i18n.getMessage("optionsFeatureLatestUpdates") + ':');

    $('.advanced').hide();
    $('#autoresize')
        .on('click', autoresize)
        .attr('checked', localStorage.feature_autoresize == "true");
    $('#preview').attr('checked', localStorage.feature_tab_preview == "true");
    $('#traces')
        .on('click', traces)
        .attr('checked', localStorage.debug == "true");
    $('#snapgroups')
        .on('click', snapgroups)
        .attr('checked', localStorage.feature_snapgroups == "true");
    $('#updates').attr('checked', localStorage.feature_latestupdates == "true");
    for (var i = 0; i < 26; i++) {
        var key = String.fromCharCode(65 + i);
        $('#shortcut_key').append('<option value="' + key + '">' + key + '</option>');
    }
    if (localStorage.shortcut_key != null) {
        $('#shortcut_ctrl').attr('checked', localStorage.shortcut_key.match('ctrl+'));
        $('#shortcut_shift').attr('checked', localStorage.shortcut_key.match('shift+'));
        var key = localStorage.shortcut_key.replace('ctrl+', '').replace('shift+', '');
        $("#shortcut_key option[value='" + key + "']").attr('selected', 'selected');
        $('#shortcut_key').attr('checked', localStorage.shortcut_key.length > 0);
    }

    $('#shortcut_ctrl,#shortcut_shift,#shortcut_key')
        .on('click', shortcut);

    // disable right-click contextual menu
    $.disableContextMenu();
});


function reloadTabSugar() {
    console.debug('reloadTabSugar');
    back.location.reload();
}

// Reinitializes localStorage and the database
function reinitialize() {
    console.debug('reinitialize');
    if (confirm("All your TabSugar groups and tabs will be reinitialized.\nAre you sure?")) {
        track('Options', 'Reset', 'Reinitialize the extension', true);

        var debug = localStorage.debug == "true";

        //$("#reinit").attr("disabled", true);

        // remove the shortcut key from the browser action's description
        chrome.browserAction.setTitle({title: "Tab Sugar"});

        // localStorage
        localStorage.clear();
        if (debug) localStorage.debug = true;
        localStorage.background_page_ready = false;
        console.debug('- localStorage cleared!');

        // database
        Storage.reset({
            success: function () {
                console.debug('- database cleared!');
                if (window.location != window.parent.window.location) {
                    window.parent.window.location.reload();
                }
                // reload the extension
                setTimeout(function () {
                    reloadTabSugar();
                    // display a success message
                    showMessage("Tab Sugar was reinitialized.");
                }, 500);
            }
        });
    } else {
        track('Options', 'Reset', 'Reinitialize the extension', false);
    }
}

// Autoresize tabs inside a group
function autoresize() {
    var checked = $("#autoresize").is(":checked");
    track('Options', 'Autoresize', 'Auto resize feature', checked);
    if (checked) {
        localStorage.feature_autoresize = true;
        showMessage("Feature 'auto rearrange' enabled.");
    } else {
        localStorage.feature_autoresize = false;
        showMessage("Feature 'auto rearrange' disabled.");
    }
}

// Activates the debugger
function traces() {
    var checked = $("#traces").is(":checked");
    track('Options', 'Developer traces', 'Developer traces', checked);
    if (checked) {
        localStorage.debug = true;
        showMessage("Developer traces activated.");
    } else {
        localStorage.debug = false;
        showMessage("Developer traces deactivated.");
    }
}

// Activates the tab previews
function preview() {
    var checked = $("#preview").is(":checked");
    track('Options', 'Tab preview', 'Tab preview feature', checked);
    if (checked) {
        localStorage.feature_tab_preview = true;
        showMessage("Feature 'tab preview' enabled.");
    } else {
        localStorage.feature_tab_preview = false;
        showMessage("Feature 'tab preview' disabled.");
    }
}

// Set the shortcut key
function shortcut() {
    track('Options', 'Shortcut key', 'Define the shortcut key');
    var last_shortcut = localStorage.shortcut_key;
    var ctrl = $("#shortcut_ctrl").is(":checked");
    var shift = $("#shortcut_shift").is(":checked");
    var key = $("#shortcut_key").val();
    var shortcut = "";
    if (ctrl) shortcut = "ctrl+";
    if (shift) shortcut = shortcut + "shift+";
    shortcut = shortcut + key;
    localStorage.shortcut_key = shortcut;
    if (last_shortcut != null) {
        $(document).unbind('keydown', last_shortcut, requestActionOpen);
    }
    $(document).unbind('keydown', shortcut, requestActionOpen);
    $(document).bind('keydown', shortcut, requestActionOpen);
    showMessage("Tab Sugar can now be triggered with '" + shortcut + "'.");
    chrome.browserAction.setTitle({title: "Tab Sugar (" + shortcut + ")"});
}

// Activates the group snapping feature (while dragging a group next to another)
function snapgroups() {
    var checked = $("#snapgroups").is(":checked");
    track('Options', 'Snap groups', 'Snap groups feature', checked);
    if (checked) {
        localStorage.feature_snapgroups = true;
        showMessage("Feature 'snap groups' enabled.");
    } else {
        localStorage.feature_snapgroups = false;
        showMessage("Feature 'snap groups' disabled.");
    }
}

// Activates the latest updates box in the dashboard
function updates() {
    var checked = $("#updates").is(":checked");
    track('Options', 'Latest updates', 'Latest updates feature', checked);
    if (checked) {
        localStorage.feature_latestupdates = true;
        showMessage("Feature 'latest updates' enabled.");
    } else {
        localStorage.feature_latestupdates = false;
        showMessage("Feature 'latest updates' disabled.");
    }
}

// Define the opening behavior
function opening() {
    //TODO
    // chrome-extension://libokbfffpaopdjmeofdfpmlanaenaje/sugar.html
}

var dev = false;

// Activate/deactivate the developer mode (advanced configuration)
function devmode() {
    dev = !dev;
    if (dev) {
        track('Options', 'Advanced configuration', 'Show the advanced configuration');
        // show advanced configuration
        $('.advanced').show('blind', 'fast');
        $('#devmode').addClass('activated');
    } else {
        // hide advanced configuration
        $('.advanced').hide('blind', 'fast');
        $('#devmode').removeClass('activated');
    }
}

function showMessage(message) {
    $('#message').hide().html(message + ' <a href="#" onclick="hideMessage()">[x]</a>').show('drop');
}

function hideMessage() {
    $('#message').hide('drop');
}
