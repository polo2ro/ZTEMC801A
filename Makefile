.PHONY: install

mkfile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
mkfile_dir := $(dir $(mkfile_path))

install:
	sudo cp zte.service /etc/systemd/system
	sudo sed -i 's~%WorkingDirectory%~${mkfile_dir}~g' /etc/systemd/system/zte.service
	sudo sed -i 's/%Password%/$(filter-out $@,$(MAKECMDGOALS))/g' /etc/systemd/system/zte.service
	sudo sed -i 's/%User%/${USER}/g' /etc/systemd/system/zte.service
	sudo sed -i 's/%Group%/$(shell id -gn)/g' /etc/systemd/system/zte.service
	cat /etc/systemd/system/zte.service
	sudo systemctl start zte

%:
	@:
