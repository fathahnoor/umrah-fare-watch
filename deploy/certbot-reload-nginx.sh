#!/bin/sh
set -eu

/usr/sbin/nginx -t 2>&1
/bin/systemctl reload nginx
