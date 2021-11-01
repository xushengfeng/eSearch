size=(16 32 48 64 128 256 512 1024)

echo Making bitmaps from your svg...

for i in ${size[@]}; do
  inkscape --export-type="png" --export-filename="icons/${i}x$i.png" -w $i -h $i icon.svg
done 
