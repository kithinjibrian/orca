HOME="."
INTERRUPTER="orca"

build() {
	echo "Building $INTERRUPTER"
	make -C "$HOME"
}

clean() {
	make -C "$HOME" clean
}

if [ "$1" == "clean" ]; then
	clean

elif [ "$1" == "run" ]; then
	build
	./a.out

elif [ "$1" == "force-run" ]; then
	clean
	build
	./a.out

elif [ "$1" == "debug" ]; then
	clean
	build
	gdb ./a.out

elif [ "$1" == "valgrind" ]; then
	clean
	build
	valgrind --leak-check=full --show-reachable=yes --track-origins=yes ./a.out
	
else
	build

fi
