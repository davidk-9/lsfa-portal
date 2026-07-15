<?php
/**
 * Plugin Name: LSFA Sync Export
 * Description: Paginated REST API endpoint for LSFA Central to sync trainer portal data from WordPress.
 * Version: 1.1.0
 * Author: David Kleinschmidt (LSFA)
 */

if ( ! defined( 'ABSPATH' ) ) {
exit;
}

define( 'LSFA_SYNC_TOKEN_KEY', 'lsfa_sync_secret_token' );
define( 'LSFA_SYNC_PREFIX_KEY', 'lsfa_sync_table_prefix' );

add_action( 'admin_menu', function () {
add_options_page( 'LSFA Sync', 'LSFA Sync', 'manage_options', 'lsfa-sync', 'lsfa_sync_page' );
} );

add_action( 'admin_init', function () {
register_setting( 'lsfa_sync', LSFA_SYNC_TOKEN_KEY );
register_setting( 'lsfa_sync', LSFA_SYNC_PREFIX_KEY );
} );

function lsfa_sync_page() {
$token  = get_option( LSFA_SYNC_TOKEN_KEY, '' );
$prefix = get_option( LSFA_SYNC_PREFIX_KEY, '' );
?>
<div class="wrap">
<h1>LSFA Sync Export <small style="color:#999">v1.1.0</small></h1>
<p>Endpoint: <code><?php echo esc_url( rest_url( 'lsfa/v1/sync' ) ); ?>?token=TOKEN&amp;table=workshop_progress&amp;offset=0&amp;limit=200</code></p>
<p>Valid table values: <code>workshop_progress</code>, <code>student_checklists</code>, <code>workshop_snapshots</code>, <code>uploads</code></p>
<form method="post" action="options.php">
<?php settings_fields( 'lsfa_sync' ); ?>
<table class="form-table">
<tr>
<th><label for="lsfa_token">Secret Token</label></th>
<td>
<input type="text" id="lsfa_token" name="<?php echo esc_attr( LSFA_SYNC_TOKEN_KEY ); ?>" value="<?php echo esc_attr( $token ); ?>" class="regular-text" />
<button type="button" class="button" onclick="var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',t='';for(var i=0;i<48;i++)t+=c[Math.floor(Math.random()*c.length)];document.getElementById('lsfa_token').value=t;">Generate</button>
<p class="description">Must match the token in LSFA Central Settings.</p>
</td>
</tr>
<tr>
<th><label for="lsfa_prefix">Table Prefix Override</label></th>
<td>
<input type="text" id="lsfa_prefix" name="<?php echo esc_attr( LSFA_SYNC_PREFIX_KEY ); ?>" value="<?php echo esc_attr( $prefix ); ?>" class="regular-text" placeholder="Leave blank for wp_" />
</td>
</tr>
</table>
<?php submit_button(); ?>
</form>
</div>
<?php
}

add_action( 'rest_api_init', function () {
register_rest_route( 'lsfa/v1', '/sync', array(
'methods'             => 'GET',
'callback'            => 'lsfa_sync_handler',
'permission_callback' => '__return_true',
) );
} );

function lsfa_sync_handler( $request ) {
$token  = (string) $request->get_param( 'token' );
$stored = (string) get_option( LSFA_SYNC_TOKEN_KEY, '' );

if ( empty( $stored ) || ! hash_equals( $stored, $token ) ) {
return new WP_Error( 'unauthorized', 'Invalid token.', array( 'status' => 401 ) );
}

global $wpdb;
$override = (string) get_option( LSFA_SYNC_PREFIX_KEY, '' );
$prefix   = $override !== '' ? $override : $wpdb->prefix;

$allowed = array(
'workshop_progress'  => $prefix . 'dktp_workshop_progress',
'student_checklists' => $prefix . 'dktp_student_checklists',
'workshop_snapshots' => $prefix . 'dktp_workshop_snapshots',
'uploads'            => $prefix . 'dktp_uploads',
);

$table_key = (string) $request->get_param( 'table' );
if ( ! isset( $allowed[ $table_key ] ) ) {
return new WP_Error( 'invalid_table', 'Unknown table. Use: ' . implode( ', ', array_keys( $allowed ) ), array( 'status' => 400 ) );
}

$table  = $allowed[ $table_key ];
$offset = max( 0, (int) $request->get_param( 'offset' ) );
$limit  = min( 500, max( 1, (int) ( $request->get_param( 'limit' ) ?: 200 ) ) );

$exists = $wpdb->get_var( "SHOW TABLES LIKE '" . esc_sql( $table ) . "'" );
if ( $exists !== $table ) {
return new WP_REST_Response( array( 'table' => $table_key, 'total' => 0, 'offset' => $offset, 'limit' => $limit, 'rows' => array() ), 200 );
}

$total = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM `' . esc_sql( $table ) . '`' );
$rows  = $wpdb->get_results(
$wpdb->prepare( 'SELECT * FROM `' . esc_sql( $table ) . '` LIMIT %d OFFSET %d', $limit, $offset ),
ARRAY_A
);

return new WP_REST_Response( array(
'table'  => $table_key,
'total'  => $total,
'offset' => $offset,
'limit'  => $limit,
'rows'   => $rows ? $rows : array(),
), 200 );
}
