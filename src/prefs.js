'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function buildPrefsWidget(settings) {
    let grid = new Gtk.Grid({
        'row-homogeneous': true,
        'row-spacing': 16,
        'column-spacing': 16,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
    });

	addSwitchAndLabel(grid, 0, settings, 'move-hot-corners', _('Move Hot Corners:'));
	addSwitchAndLabel(grid, 1, settings, 'avoid-fullscreen', _('Avoid Fullscreen Windows:'));
	addSwitchAndLabel(grid, 2, settings, 'manual-controls', _('Show Manual Controls:'));

	return grid;
}

function addSwitchAndLabel(grid, row, settings, key, labeltext) {
	let label = new Gtk.Label({
        label: labeltext,
        halign: Gtk.Align.START,
        valign: Gtk.Align.BASELINE
    });

	let switcher = new Gtk.Switch({
        halign: Gtk.Align.START,
        valign: Gtk.Align.BASELINE
    });
	settings.bind(key, switcher, 'active', Gio.SettingsBindFlags.DEFAULT);

	grid.attach(label, 0, row, 1, 1);
	grid.attach(switcher, 1, row, 1, 1);
}

export default class PanelMoverExtensionPreferences extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);
        this.initTranslations();
    }

    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: _('Preferences'),
        });
        group.add(buildPrefsWidget(window._settings));
        page.add(group);
        window.add(page);
    }
}
